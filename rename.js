const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const ignoreDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.prisma', '.gemini'];

// Renames directories and files (post-order traversal: rename children first, then parent)
function renameRecursively(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch(e) { return dir; }
  
  for (const file of files) {
    if (ignoreDirs.includes(file)) continue;
    
    let currentPath = path.join(dir, file);
    const stats = fs.statSync(currentPath);
    
    if (stats.isDirectory()) {
      currentPath = renameRecursively(currentPath);
    }
    
    // Rename file/dir
    const fileName = path.basename(currentPath);
    let newName = fileName;
    newName = newName.replace(/petition/g, 'ticket').replace(/Petition/g, 'Ticket');
    
    if (newName !== fileName) {
      const newPath = path.join(path.dirname(currentPath), newName);
      fs.renameSync(currentPath, newPath);
      console.log(`Renamed: ${currentPath} -> ${newPath}`);
    }
  }
  return dir;
}

// Replace contents
function replaceContentRecursively(dir) {
  let files;
  try { files = fs.readdirSync(dir); } catch(e) { return; }
  
  for (const file of files) {
    if (ignoreDirs.includes(file)) continue;
    
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      replaceContentRecursively(filePath);
    } else {
      // Only text files
      if (!filePath.match(/\.(ts|tsx|js|jsx|json|prisma|md|css|html)$/)) continue;
      if (file === 'package-lock.json' || file === 'rename.js') continue;
      
      let content = fs.readFileSync(filePath, 'utf8');
      const original = content;
      
      // Petitions
      content = content.replace(/Petitions/g, 'Tickets');
      content = content.replace(/petitions/g, 'tickets');
      content = content.replace(/Petition/g, 'Ticket');
      content = content.replace(/petition/g, 'ticket');
      content = content.replace(/PETITION/g, 'TICKET');
      
      // Students -> Submitters
      content = content.replace(/Students/g, 'Submitters');
      content = content.replace(/students/g, 'submitters');
      content = content.replace(/Student/g, 'Submitter');
      content = content.replace(/student/g, 'submitter');
      
      // Departments -> Groups
      content = content.replace(/Departments/g, 'Groups');
      content = content.replace(/departments/g, 'groups');
      content = content.replace(/Department/g, 'Group');
      content = content.replace(/department/g, 'group');
      
      // Hardcoded string fixes that might be affected
      // e.g. "submitterId" was "studentId"
      
      if (original !== content) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated content: ${filePath}`);
      }
    }
  }
}

try {
  console.log('--- Starting Renaming of Files/Dirs ---');
  renameRecursively(projectRoot);

  console.log('\n--- Starting Content Replacement ---');
  replaceContentRecursively(projectRoot);

  console.log('\nDone.');
} catch (error) {
  console.error(error);
  process.exit(1);
}
