const { chromium } = require("playwright");
const fs = require("fs-extra");
const path = require("path");

const CAMPAIGNS_DIR = path.resolve("campaigns");

async function selectCampaignFolder() {
  const { default: inquirer } = await import("inquirer");

  const folders = fs
    .readdirSync(CAMPAIGNS_DIR)
    .filter((f) => fs.lstatSync(path.join(CAMPAIGNS_DIR, f)).isDirectory());
  const { folder } = await inquirer.prompt({
    name: "folder",
    type: "list",
    message: "폴더를 선택해주세요:",
    choices: folders,
  });
  return folder;
}

async function selectLogFile(folderPath) {
  const { default: inquirer } = await import("inquirer");

  const logDir = path.join(folderPath, "log");
  const files = fs.readdirSync(logDir);
  const { file } = await inquirer.prompt({
    name: "file",
    type: "list",
    message: "로그 파일을 선택해주세요:",
    choices: files,
  });
  return path.join(logDir, file);
}

async function clickOptionMenu(page, childrenIndex) {
  await page.waitForSelector("ms-chat-turn-options");
  const prompts = await page.$$("ms-chat-turn");
  const last = prompts[prompts.length - 1];
  await last.hover();

  const options = await last.$("ms-chat-turn-options");
  const button = await options.$("button");
  await button.click();

  await page.waitForSelector(".mat-mdc-menu-content");
  const menus = await page.$$(".mat-mdc-menu-content");
  const buttons = await menus[0].$$("button");

  await buttons[childrenIndex].click();
  await page.waitForTimeout(500);
}

async function eraseChatLog(page) {
  while ((await page.$("ms-chat-turn-options")) !== null) {
    await clickOptionMenu(page, 0);
    console.log("🗑 이전 대화 내역을 삭제했습니다.");
  }
}

async function writeTextarea(page, text) {
  const { default: clipboard } = await import("clipboardy");

  await clipboard.write(text);
  const textarea = await page.$("textarea");
  await textarea.fill("");
  await textarea.click();
  await page.keyboard.press(`Control+V`);
}

async function waitForEnter() {
  return new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("⚠️ 에러 감지됨. Enter 키를 누르면 계속합니다...", () => {
      rl.close();
      resolve();
    });
  });
}

async function runAndWait(page) {
  await page.locator("button", { hasText: "Run" }).click();
  const start = Date.now();

  // spin 이 사라질 때까지 대기
  await page.locator(".spin").waitFor({
    state: "detached",
    timeout: 3000000,
  });

  const elapsed = Date.now() - start;

  // 2초 안에 끝났으면 에러로 간주
  if (elapsed < 2000) {
    console.error(
      `❌ Run 실행 후 ${elapsed}ms 만에 종료됨 (에러로 간주)`
    );

    await waitForEnter();
  }
}

function replacePlaceholders(text, label, logContent) {
  const wrappedLog = "```\n" + logContent + "\n```";

  return text.replaceAll("{label}", label).replaceAll("{log}", wrappedLog);
}

function saveClipboardToPath(baseFolder, label, mdPath, content) {
  const fullDir = path.join(baseFolder, "KB", label, path.dirname(mdPath));
  const fullFile = path.join(fullDir, path.basename(mdPath));

  fs.mkdirSync(fullDir, { recursive: true });
  fs.writeFileSync(fullFile, content);
}

async function writeKBFile(page, folderPath) {
  const kbText = fs.readFileSync(path.join(folderPath, "KB.txt"), "utf-8");

  await writeTextarea(page, kbText);
  await runAndWait(page);
}

async function writeLogFile(page, label, logContent) {
  const updatePath = path.join(CAMPAIGNS_DIR, "update.txt");
  const updateRaw = fs.readFileSync(updatePath, "utf-8");
  const replacedUpdate = replacePlaceholders(updateRaw, label, logContent);

  await writeTextarea(page, replacedUpdate);
  await runAndWait(page);
}

async function processMDList(page, baseFolder, label) {
  const { default: clipboard } = await import("clipboardy");

  await clickOptionMenu(page, 3);
  await page.waitForTimeout(500);
  const clipboardContent = await clipboard.read();
  const mdLines = clipboardContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".md"));

  console.log("📋 업데이트된 파일 목록: ", mdLines);

  for (const mdFile of mdLines) {
    console.log(`📌 ${mdFile} 처리 중...`);

    await writeTextarea(page, mdFile);
    await runAndWait(page);
    await page.waitForTimeout(500);
    await clickOptionMenu(page, 3);
    await page.waitForTimeout(500);

    const copied = await clipboard.read();
    saveClipboardToPath(baseFolder, label, mdFile, copied);
  }
}

async function copyLatestFiles(folderPath, label) {
  const latestDir = path.join(folderPath, "KB", "latest");
  const labelDir = path.join(folderPath, "KB", label);

  // fs.cpSync 대신 fs-extra의 안정적인 메서드 사용 (Segmentation fault 방지)
  // 기존 데이터를 유지하면서 덮어쓰기 위해 emptyDirSync 제거
  fs.copySync(labelDir, latestDir, { overwrite: true });
  console.log("📌 KB/latest 복사가 완료되었습니다!");
}

async function main() {
  const { default: inquirer } = await import("inquirer");

  // 경로 선택
  const folder = await selectCampaignFolder();
  const folderPath = path.join(CAMPAIGNS_DIR, folder);
  const logPath = await selectLogFile(folderPath);
  const logContent = fs.readFileSync(logPath, "utf-8");

  const { label } = await inquirer.prompt({
    name: "label",
    type: "input",
    message: "로그 이름을 입력하세요:",
  });

  console.log(`📁 폴더: ${folder}`);
  console.log(`📝 로그: ${logPath}`);
  console.log(`🏷️ 라벨: ${label}`);

  // 구글 AI 스튜디오 접속
  const browser = await chromium.launchPersistentContext("./user_data/8", {
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
    viewport: { width: 2560, height: 1080 },
  });

  const pages = browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();
  // 패스파인더
  //  await page.goto(
  //    "https://aistudio.google.com/u/1/prompts/1XvpEt1Ygr9EKB8SA9aNuQfRH7VuGJgO-",
  //  );
  // 시트론 1
  // await page.goto(
  //   "https://aistudio.google.com/u/1/prompts/17T-ly8tPyFqyKY9ZASsvQ6FL3sOUfLsa",
  // );
  // 시트론 2
  // await page.goto(
  //   "https://aistudio.google.com/u/1/prompts/1JAU4fxM4WeuR3-6YNx6dYquzAYnajQze",
  // );
  // 듀얼단
  await page.goto(
    "https://aistudio.google.com/u/1/prompts/1A8cN9pED4TdlWozYfjfQFBi4_YMwRCwb"
  );
  // 듀얼단 2
  // await page.goto(
  //   "https://aistudio.google.com/u/1/prompts/1-T1Rv1SMl0TjQBG7t7L_3aWEnb1RS170"
  // );
  // 듀얼단 3 (arm1)
  // await page.goto(
  //   "https://aistudio.google.com/u/1/prompts/1Bq-4hbsYWimlOrCbfqZ1lGJ-oDEBr9cs"
  // );
  // 듀얼단 4 (arm2)
  // await page.goto(
  //   "https://aistudio.google.com/u/1/prompts/1yq4-iaEh0LIHNm-RH35s8Cn5f-qj-CMa"
  // );
  // 듀얼단 5 (arm3)
  // await page.goto(
  //   "https://aistudio.google.com/u/1/prompts/1l3sAth_WmfbEWIv3ei17B0IDGNmJjWzK"
  // );
  // 듀얼단 6 (arm5)
  // await page.goto(
  //   "https://aistudio.google.com/u/1/prompts/18cXzpP80m6cwSq-GcsnfK0zyApbRXRcM"
  // );
  // 듀얼단 7 (korea)
  // await page.goto(
  //   "https://aistudio.google.com/u/1/prompts/1vkHW882mtbEfjIdpK42Jg_LOUiZVvTOR"
  // );
  // 듀얼단 8 (arm6)
  await page.goto(
    "https://aistudio.google.com/u/1/prompts/1fbB38xzGoF8ylmS2o_M23S5cxUld-gQY"
  );
  // 듀얼단 9 (arm7)
  // await page.goto(
  //   "https://aistudio.google.com/u/1/prompts/1O8zK5oNh79tEh9wE3ILt2yWrGM33gbcn"
  // );
  await page.waitForSelector("textarea", { timeout: 60000 });

  if (label === "") {
    await waitForEnter();
  }

  // 이전 대화 내역 전부 삭제
  // await eraseChatLog(page);

  // KB.txt 내용 입력
  //await writeKBFile(page, folderPath);

  // 사용자가 선택한 로그 내용 입력
  // await writeLogFile(page, label, logContent);

  // 업데이트된 지식 베이스 파일 목록 추출 및 반영
  await processMDList(page, folderPath, label);

  // KB/latest 폴더에 복사
  // await copyLatestFiles(folderPath, label);

  await browser.close();
  console.log("\n✨ 지식 베이스 작업 완료!");
}

main().catch(console.error);
