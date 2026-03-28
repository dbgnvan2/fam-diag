const YEAR_ONLY = /^\d{4}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;

export const expandPartialDate = (text: string): string => {
  if (YEAR_ONLY.test(text)) return `${text}-01-01`;
  if (YEAR_MONTH.test(text)) return `${text}-01`;
  return text;
};
