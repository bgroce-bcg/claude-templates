#!/usr/bin/env node

/**
 * Documentation Indexer
 * Scans documentation files and indexes them in the SQLite database
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Configuration
const DB_PATH = path.join(__dirname, '../project.db');
const DOCS_ROOT = path.join(__dirname, '../../docs');

// Category mappings based on directory structure
const CATEGORY_MAP = {
  'backend': 'backend',
  'frontend': 'frontend',
  'design': 'frontend',
  'features': 'feature',
  'feature': 'feature',
  'plans': 'plan',
  'scrum': 'plan',
  'misc': 'backend'
};

/**
 * Parse frontmatter from markdown file
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const frontmatter = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    let value = line.substring(colonIndex + 1).trim();

    // Handle arrays like [tag1, tag2]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.substring(1, value.length - 1)
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);
    }

    frontmatter[key] = value;
  }

  return frontmatter;
}

/**
 * Infer title from filename or first heading
 */
function inferTitle(filename, content) {
  // Try to get first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // Fall back to filename without extension
  return filename.replace(/\.md$/, '').replace(/[-_]/g, ' ');
}

/**
 * Infer category from file path
 */
function inferCategory(filePath) {
  const relativePath = path.relative(DOCS_ROOT, filePath);
  const parts = relativePath.split(path.sep);

  if (parts.length === 0) return 'backend';

  const firstDir = parts[0].toLowerCase();
  return CATEGORY_MAP[firstDir] || 'backend';
}

/**
 * Extract summary from content
 */
function extractSummary(content) {
  // Remove frontmatter
  content = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');

  // Remove markdown syntax
  content = content
    .replace(/^#+\s+/gm, '') // Remove headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italic
    .replace(/`(.+?)`/g, '$1') // Remove code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
    .trim();

  // Get first paragraph (up to 200 chars)
  const firstPara = content.split('\n\n')[0];
  if (firstPara.length <= 200) {
    return firstPara;
  }

  return firstPara.substring(0, 197) + '...';
}

/**
 * Estimate token count
 */
function estimateTokens(content) {
  const words = content.split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

/**
 * Get all markdown files recursively
 */
function getMarkdownFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Main indexing function
 */
function indexDocumentation() {
  console.log('📚 Starting documentation indexing...\n');

  // Open database
  const db = new Database(DB_PATH);

  // Get all markdown files
  const files = getMarkdownFiles(DOCS_ROOT);
  console.log(`Found ${files.length} markdown files\n`);

  // Prepare statements
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO context_documents
    (file_path, title, category, summary, tags, feature_id, estimated_tokens, file_modified, last_indexed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const getExistingStmt = db.prepare(`
    SELECT file_path, last_indexed FROM context_documents
  `);

  // Get existing documents
  const existing = new Map();
  for (const row of getExistingStmt.all()) {
    existing.set(row.file_path, row.last_indexed);
  }

  // Track statistics
  const stats = {
    new: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };

  // Process each file
  for (const filePath of files) {
    try {
      const relativePath = path.relative(process.cwd(), filePath);
      const stat = fs.statSync(filePath);
      const modifiedTime = Math.floor(stat.mtimeMs / 1000);

      // Check if file needs indexing
      const lastIndexed = existing.get(relativePath);
      if (lastIndexed) {
        const lastIndexedTime = Math.floor(new Date(lastIndexed).getTime() / 1000);
        if (modifiedTime <= lastIndexedTime) {
          console.log(`⏭️  Skipping (unchanged): ${relativePath}`);
          stats.skipped++;
          continue;
        }
      }

      // Read file
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse frontmatter
      const frontmatter = parseFrontmatter(content);

      // Extract metadata
      const title = (frontmatter && frontmatter.title) || inferTitle(path.basename(filePath), content);
      const category = (frontmatter && frontmatter.category) || inferCategory(filePath);
      const summary = (frontmatter && frontmatter.summary) || extractSummary(content);
      const tags = frontmatter && frontmatter.tags ?
        (Array.isArray(frontmatter.tags) ? JSON.stringify(frontmatter.tags) : frontmatter.tags) :
        null;
      const estimatedTokens = estimateTokens(content);

      // Insert/update in database
      insertStmt.run(
        relativePath,
        title,
        category,
        summary,
        tags,
        null, // feature_id - will be linked later if needed
        estimatedTokens,
        modifiedTime
      );

      if (lastIndexed) {
        console.log(`✅ Updated: ${relativePath}`);
        console.log(`   Title: ${title}`);
        console.log(`   Category: ${category}`);
        console.log(`   Tokens: ${estimatedTokens}\n`);
        stats.updated++;
      } else {
        console.log(`🆕 New: ${relativePath}`);
        console.log(`   Title: ${title}`);
        console.log(`   Category: ${category}`);
        console.log(`   Tokens: ${estimatedTokens}\n`);
        stats.new++;
      }

    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
      stats.errors++;
    }
  }

  // Clean up orphaned entries
  const allFilePaths = files.map(f => path.relative(process.cwd(), f));
  const orphaned = Array.from(existing.keys()).filter(p => !allFilePaths.includes(p));

  if (orphaned.length > 0) {
    console.log(`\n🧹 Cleaning up ${orphaned.length} orphaned entries...`);
    const deleteStmt = db.prepare(`DELETE FROM context_documents WHERE file_path = ?`);

    for (const filePath of orphaned) {
      deleteStmt.run(filePath);
      console.log(`   Removed: ${filePath}`);
    }
  }

  // Get final statistics
  const categoryStats = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(estimated_tokens) as tokens
    FROM context_documents
    GROUP BY category
  `).all();

  const totalStats = db.prepare(`
    SELECT COUNT(*) as count, SUM(estimated_tokens) as tokens
    FROM context_documents
  `).get();

  // Close database
  db.close();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 INDEXING SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n🆕 New documents:     ${stats.new}`);
  console.log(`✏️  Updated documents: ${stats.updated}`);
  console.log(`⏭️  Skipped (unchanged): ${stats.skipped}`);
  console.log(`🧹 Removed (orphaned): ${orphaned.length}`);
  console.log(`❌ Errors:            ${stats.errors}`);

  console.log('\n' + '-'.repeat(60));
  console.log('📁 CATEGORY BREAKDOWN');
  console.log('-'.repeat(60));

  for (const row of categoryStats) {
    console.log(`${row.category.padEnd(15)} ${String(row.count).padStart(3)} docs    ${String(row.tokens).padStart(7)} tokens`);
  }

  console.log('-'.repeat(60));
  console.log(`${'TOTAL'.padEnd(15)} ${String(totalStats.count).padStart(3)} docs    ${String(totalStats.tokens).padStart(7)} tokens`);
  console.log('='.repeat(60) + '\n');
}

// Run indexer
if (require.main === module) {
  indexDocumentation();
}

module.exports = { indexDocumentation };
