const { execSync } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("📦 배포를 시작합니다...\n");

rl.question("커밋 메시지를 입력하세요 (기본값: deploy): ", (message) => {
  // 입력값이 없으면 기본값 사용
  const commitMessage = message.trim() || "deploy";
  
  console.log(`\n✓ 커밋 메시지: "${commitMessage}"\n`);

  try {
    // Git 설정
    console.log("🔧 Git 설정 중...");
    execSync("git config --global user.email dwaldo@naver.com", { stdio: "inherit" });
    execSync("git config --global user.name dwaldo", { stdio: "inherit" });

    // Git add
    console.log("📝 변경 사항 추가 중...");
    execSync("git add .", { stdio: "inherit" });

    // Git commit
    console.log("💾 커밋 중...");
    try {
      execSync(`git commit -m "${commitMessage}"`, { stdio: "inherit" });
    } catch (commitError) {
      // 커밋할 내용이 없는 경우
      if (commitError.message.includes("nothing to commit")) {
        console.log("\n✨ 커밋할 변경 사항이 없습니다. 모든 파일이 최신 상태입니다.");
        rl.close();
        return;
      }
      throw commitError;
    }

    // Git push
    console.log("🚀 푸시 중...");
    execSync("git push --force", { stdio: "inherit" });

    console.log("\n✅ 배포가 완료되었습니다!");
  } catch (error) {
    console.error("\n❌ 배포 중 오류가 발생했습니다:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
});
