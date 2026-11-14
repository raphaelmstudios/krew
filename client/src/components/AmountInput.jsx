// A money amount in shillings.
//
// Accepts an amount however people naturally type it - "5000", "5,000", "5 000",
// "KES 5,000", "Ksh5000" or "5k" - instead of rejecting anything that isn't bare digits.
// While typing, the number is shown grouped in thousands (5,000 / 25,000 / 150,000), which is
// much easier to read and check at a glance than a run of zeros.
//
// The parent still works with plain digits: onValueChange receives "5000" (or "" when empty),
// so Number(value) and the existing checks keep working unchanged.
const MAX_DIGITS = 9;

export function parseAmountText(text) {
  const cleaned = String(text ?? '')
    .toLowerCase()
    .replace(/kes|ksh|shs?|\/=|=/g, '')
    .replace(/[\s,_']/g, '')
    .trim();
  if (!cleaned) return '';
  // "5k" or "2.5k" means thousands
  const thousands = cleaned.match(/^(\d+(?:\.\d+)?)k$/);
  if (thousands) return String(Math.round(Number(thousands[1]) * 1000)).slice(0, MAX_DIGITS);
  // Shillings only: anything after a decimal point is dropped
  const whole = cleaned.split('.')[0].replace(/\D/g, '');
  return whole.replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITS);
}

export function formatAmount(value) {
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US') : '';
}

export default function AmountInput({ value, onValueChange, ...props }) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatAmount(value)}
      onChange={(event) => onValueChange(parseAmountText(event.target.value))}
    />
  );
}
