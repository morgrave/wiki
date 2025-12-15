const fs = require("fs-extra");
const path = require("path");

const baseDir = path.resolve("campaigns");

// Helper function to load project's index.json
function loadProjectIndex(projectId) {
  const indexPath = path.join(baseDir, projectId, "index.json");
  if (fs.existsSync(indexPath)) {
    try {
      return JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    } catch (e) {
      console.error(`Failed to parse index.json for ${projectId}:`, e.message);
    }
  }
  return null;
}

// Recursively resolve all dependencies for a project
// Returns array of project IDs in order of priority (later = higher priority)
function resolveDependencies(projectId, visited = new Set()) {
  // Prevent circular dependencies
  if (visited.has(projectId)) {
    return [];
  }
  visited.add(projectId);

  const projectIndex = loadProjectIndex(projectId);
  if (!projectIndex || !projectIndex.dependency) {
    return [];
  }

  const result = [];

  // Process dependencies in order
  for (const depId of projectIndex.dependency) {
    // First resolve nested dependencies
    const nestedDeps = resolveDependencies(depId, visited);
    for (const nested of nestedDeps) {
      if (!result.includes(nested)) {
        result.push(nested);
      }
    }
    // Then add this dependency
    if (!result.includes(depId)) {
      result.push(depId);
    }
  }

  return result;
}

// Get all markdown files from a directory recursively
function getMarkdownFiles(dir, relativeTo = dir) {
  const results = [];
  
  if (!fs.existsSync(dir)) {
    return results;
  }

  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      results.push(...getMarkdownFiles(fullPath, relativeTo));
    } else if (item.endsWith('.md')) {
      const relativePath = path.relative(relativeTo, fullPath).replace(/\\/g, '/');
      results.push({
        relativePath,
        fullPath,
        fileName: item
      });
    }
  }
  
  return results;
}

async function main() {
  const { default: inquirer } = await import("inquirer");

  // campaigns 폴더 내의 디렉터리 목록 가져오기 (index.json이 있는 것만)
  const folders = fs
    .readdirSync(baseDir)
    .filter((file) => {
      const isDir = fs.statSync(path.join(baseDir, file)).isDirectory();
      const hasIndex = fs.existsSync(path.join(baseDir, file, "index.json"));
      return isDir && hasIndex;
    });

  if (folders.length === 0) {
    console.error("campaigns 폴더 아래에 index.json을 가진 하위 폴더가 없습니다.");
    return;
  }

  // inquirer로 하위 폴더 선택
  const { name } = await inquirer.prompt([
    {
      type: "list",
      name: "name",
      message: "대상 폴더를 선택하세요:",
      choices: folders,
    },
  ]);

  const targetKBDir = path.join(baseDir, name, "KB", "latest");
  const outputFilePath = path.join(baseDir, name, "KB.txt");

  // Resolve dependencies
  const dependencies = resolveDependencies(name);
  console.log(`\n📦 프로젝트: ${name}`);
  if (dependencies.length > 0) {
    console.log(`🔗 의존성: ${dependencies.join(" → ")} → ${name}`);
  }

  // Collect all documents with deduplication (later = higher priority)
  // Key: relativePath, Value: { fullPath, sourceProject }
  const docMap = new Map();

  // First, add documents from dependencies (in order, so later ones override)
  for (const depId of dependencies) {
    const depKBDir = path.join(baseDir, depId, "KB", "latest");
    const depFiles = getMarkdownFiles(depKBDir);
    
    for (const file of depFiles) {
      docMap.set(file.relativePath, {
        fullPath: file.fullPath,
        relativePath: file.relativePath,
        sourceProject: depId
      });
    }
  }

  // Then add own documents (highest priority, overrides dependencies)
  const ownFiles = getMarkdownFiles(targetKBDir);
  for (const file of ownFiles) {
    docMap.set(file.relativePath, {
      fullPath: file.fullPath,
      relativePath: file.relativePath,
      sourceProject: null // Own project
    });
  }

  // Group files by subdirectory and sort
  const filesBySubDir = new Map();
  for (const doc of docMap.values()) {
    const parts = doc.relativePath.split('/');
    const subDir = parts.length > 1 ? parts[0] : '';
    
    if (!filesBySubDir.has(subDir)) {
      filesBySubDir.set(subDir, []);
    }
    filesBySubDir.get(subDir).push(doc);
  }

  // Sort subdirectories
  const sortedSubDirs = Array.from(filesBySubDir.keys()).sort();

  let output = `**지식 베이스(KB) 내용:**\n\n`;
  let totalFiles = 0;
  let inheritedFiles = 0;

  for (const subDir of sortedSubDirs) {
    const files = filesBySubDir.get(subDir);
    
    // Sort files within subdirectory
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { 
      numeric: true, 
      sensitivity: 'base' 
    }));

    for (const file of files) {
      const content = fs.readFileSync(file.fullPath, "utf-8");
      
      output += `---\n\n${file.relativePath}\n\n${content}\n`;
      totalFiles++;
      if (file.sourceProject) {
        inheritedFiles++;
      }
    }
  }

  fs.writeFileSync(outputFilePath, output, "utf-8");
  console.log(`\n✅ KB.txt 생성 완료: ${outputFilePath}`);
  console.log(`📄 총 ${totalFiles}개 파일 (상속된 파일: ${inheritedFiles}개)`);
}

main().catch(console.error);
