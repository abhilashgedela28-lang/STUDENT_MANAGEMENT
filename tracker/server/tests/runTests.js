const { execSync } = require('child_process');
const path = require('path');

async function runAll() {
  console.log('Running CodeTrack Test Suites...\n');

  try {
    console.log('>>> Running Platform Connectors Unit Tests...');
    execSync('node tests/connectorsTest.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

    console.log('\n>>> Running End-to-End System Tests...');
    execSync('node tests/e2eTest.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

    console.log('\nALL CODE TRACK TESTS COMPLETED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('\nTest Suite Failed!');
    process.exit(1);
  }
}

runAll();
