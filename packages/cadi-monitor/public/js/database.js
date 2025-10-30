/**
 * Database Explorer functionality for CADI Monitor
 */

// Global state for database explorer
const databaseState = {
  currentTable: null,
  currentOffset: 0,
  currentLimit: 50
};

/**
 * Load tables for the selected project
 */
async function loadDatabaseTables(projectId) {
  try {
    const response = await fetch(`/api/projects/${projectId}/database/tables`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load tables');
    }

    renderDatabaseTables(data.tables);
  } catch (error) {
    console.error('Error loading database tables:', error);
    document.getElementById('databaseTablesList').innerHTML = `
      <div class="empty-state">
        <p>Error loading tables: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Render the list of database tables
 */
function renderDatabaseTables(tables) {
  const container = document.getElementById('databaseTablesList');

  if (!tables || tables.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No tables found in database</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="database-tables-grid">
      ${tables.map(table => `
        <div class="database-table-card card" data-table="${table.name}">
          <div class="database-table-header">
            <h4>${table.name}</h4>
            <span class="badge">${table.rowCount} rows</span>
          </div>
          <button class="btn-secondary btn-sm" onclick="loadTableData('${table.name}')">
            View Data
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Load data for a specific table
 */
async function loadTableData(tableName, offset = 0, limit = 50) {
  // Get current project from global monitor instance
  const projectId = window.cadiMonitor ? window.cadiMonitor.selectedProject : null;
  if (!projectId) {
    console.error('No project selected');
    return;
  }

  databaseState.currentTable = tableName;
  databaseState.currentOffset = offset;
  databaseState.currentLimit = limit;

  try {
    const response = await fetch(`/api/projects/${projectId}/database/tables/${tableName}?offset=${offset}&limit=${limit}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load table data');
    }

    renderTableData(data);
  } catch (error) {
    console.error('Error loading table data:', error);
    document.getElementById('databaseTablesList').innerHTML = `
      <div class="empty-state">
        <p>Error loading table data: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Render table data with schema and rows
 */
function renderTableData(data) {
  const container = document.getElementById('databaseTablesList');

  const hasMore = data.pagination.hasMore;
  const hasPrevious = data.pagination.offset > 0;

  container.innerHTML = `
    <div class="database-table-detail">
      <!-- Header with back button -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <button class="btn-secondary btn-sm" onclick="loadDatabaseTables(window.cadiMonitor.selectedProject)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-right: 0.25rem;">
              <path d="M15 8H1M8 1L1 8l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Back to Tables
          </button>
          <h3 style="margin: 0;">${data.tableName}</h3>
          <span class="badge">${data.totalCount} total rows</span>
        </div>
      </div>

      <!-- Schema section -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 0.75rem;">Schema</h4>
        <pre style="background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.8125rem;">${data.schema}</pre>
      </div>

      <!-- Columns info -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 0.75rem;">Columns (${data.columns.length})</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
          ${data.columns.map(col => `
            <div style="padding: 0.5rem; background: var(--bg); border: 1px solid var(--border); border-radius: 0.375rem;">
              <div style="font-weight: 600; font-size: 0.875rem;">${col.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">${col.type}${col.pk ? ' (PK)' : ''}${col.notnull ? ' NOT NULL' : ''}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Data table -->
      <div class="card">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <h4 style="margin: 0;">Data (showing ${data.pagination.offset + 1}-${Math.min(data.pagination.offset + data.pagination.limit, data.totalCount)} of ${data.totalCount})</h4>
          <div class="pagination-controls">
            <button class="btn-secondary btn-sm"
                    onclick="loadTableData('${data.tableName}', ${Math.max(0, data.pagination.offset - data.pagination.limit)}, ${data.pagination.limit})"
                    ${!hasPrevious ? 'disabled' : ''}>
              Previous
            </button>
            <button class="btn-secondary btn-sm"
                    onclick="loadTableData('${data.tableName}', ${data.pagination.offset + data.pagination.limit}, ${data.pagination.limit})"
                    ${!hasMore ? 'disabled' : ''}>
              Next
            </button>
          </div>
        </div>
        ${data.rows.length === 0 ? `
          <div class="empty-state">
            <p>No rows in this table</p>
          </div>
        ` : `
          <div style="overflow-x: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  ${data.columns.map(col => `<th>${col.name}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${data.rows.map(row => `
                  <tr>
                    ${data.columns.map(col => {
                      const value = row[col.name];
                      const displayValue = value === null ? '<em style="color: var(--text-secondary);">NULL</em>'
                                        : value === '' ? '<em style="color: var(--text-secondary);">(empty)</em>'
                                        : escapeHtml(String(value));
                      return `<td>${displayValue}</td>`;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}

/**
 * Execute a custom SQL query
 */
async function executeQuery() {
  // Get current project from global monitor instance
  const projectId = window.cadiMonitor ? window.cadiMonitor.selectedProject : null;
  if (!projectId) {
    alert('Please select a project first');
    return;
  }

  const query = document.getElementById('sqlQueryInput').value.trim();
  if (!query) {
    alert('Please enter a SQL query');
    return;
  }

  const executeBtn = document.getElementById('executeQueryBtn');
  executeBtn.disabled = true;
  executeBtn.textContent = 'Executing...';

  try {
    const response = await fetch(`/api/projects/${projectId}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Query execution failed');
    }

    renderQueryResults(data);
  } catch (error) {
    console.error('Error executing query:', error);
    const resultsDiv = document.getElementById('queryResults');
    resultsDiv.style.display = 'block';
    document.getElementById('queryRowCount').textContent = '0';
    document.getElementById('queryResultsContent').innerHTML = `
      <div class="card" style="background: var(--error-bg, #fee); border: 1px solid var(--error-border, #f88); padding: 1rem;">
        <p style="color: var(--error, #c00); margin: 0;">Error: ${escapeHtml(error.message)}</p>
      </div>
    `;
  } finally {
    executeBtn.disabled = false;
    executeBtn.textContent = 'Execute Query';
  }
}

/**
 * Render query results
 */
function renderQueryResults(data) {
  const resultsDiv = document.getElementById('queryResults');
  const rowCountSpan = document.getElementById('queryRowCount');
  const contentDiv = document.getElementById('queryResultsContent');

  resultsDiv.style.display = 'block';
  rowCountSpan.textContent = data.rowCount;

  if (data.rowCount === 0) {
    contentDiv.innerHTML = `
      <div class="empty-state">
        <p>Query returned no results</p>
      </div>
    `;
    return;
  }

  // Get column names from first row
  const columns = Object.keys(data.results[0]);

  contentDiv.innerHTML = `
    <div style="overflow-x: auto;">
      <table class="data-table">
        <thead>
          <tr>
            ${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.results.map(row => `
            <tr>
              ${columns.map(col => {
                const value = row[col];
                const displayValue = value === null ? '<em style="color: var(--text-secondary);">NULL</em>'
                                  : value === '' ? '<em style="color: var(--text-secondary);">(empty)</em>'
                                  : escapeHtml(String(value));
                return `<td>${displayValue}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Clear query input and results
 */
function clearQuery() {
  document.getElementById('sqlQueryInput').value = '';
  document.getElementById('queryResults').style.display = 'none';
  document.getElementById('queryResultsContent').innerHTML = '';
  document.getElementById('queryRowCount').textContent = '0';
}

/**
 * Helper function to escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Execute query button
  const executeBtn = document.getElementById('executeQueryBtn');
  if (executeBtn) {
    executeBtn.addEventListener('click', executeQuery);
  }

  // Clear query button
  const clearBtn = document.getElementById('clearQueryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearQuery);
  }

  // Enter key in query textarea (Ctrl+Enter to execute)
  const queryInput = document.getElementById('sqlQueryInput');
  if (queryInput) {
    queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        executeQuery();
      }
    });
  }
});
