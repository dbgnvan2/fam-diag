/**
 * Export person inventory as CSV for manual verification.
 */

import type { PersonInventoryItem } from './personInventory';

export function exportInventoryToCSV(inventory: PersonInventoryItem[]): string {
  const headers = ['Name', 'Gender', 'Relationships', 'Children', 'Confidence', 'Notes', 'Status'];
  const rows = inventory.map((item) => [
    item.name,
    item.gender,
    item.relationshipCount.toString(),
    item.childrenCount.toString(),
    `${Math.round(item.extractedConfidence * 100)}%`,
    item.notes || '',
    '', // Status column left empty for user to fill in
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          // Escape quotes and wrap in quotes if contains comma or quote
          const str = String(cell || '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\n');

  return csv;
}

export function downloadInventoryCSV(inventory: PersonInventoryItem[], filename = 'diagram-inventory.csv'): void {
  const csv = exportInventoryToCSV(inventory);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
