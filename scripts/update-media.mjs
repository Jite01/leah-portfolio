import { execSync } from 'child_process';
import fs from 'fs/promises';

const MEDIA_JSON = './src/data/media.json';

async function main() {
  // Run fetch-media to scrape and update media.json
  console.log('Running fetch-media...');
  execSync('node scripts/fetch-media.mjs', { stdio: 'inherit' });

  // Check if media.json was actually modified
  const diff = execSync('git diff --name-only', { encoding: 'utf-8' });
  if (!diff.includes('media.json')) {
    console.log('No new media found. Skipping commit.');
    return;
  }

  // Commit and push
  execSync('git config user.name "github-actions[bot]"');
  execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
  execSync('git add src/data/media.json');
  execSync('git commit -m "auto: update Day in Finance"');
  execSync('git push');

  console.log('Pushed updated media.json');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
