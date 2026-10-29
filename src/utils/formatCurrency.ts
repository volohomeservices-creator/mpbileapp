/**
 * Formats a number as INR currency (₹).
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '₹0.00';
  const num = Number(amount);
  if (isNaN(num)) return '₹0.00';
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
