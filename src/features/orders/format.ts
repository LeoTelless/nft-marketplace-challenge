/** "26 nov. 2026" (compact, as "29 Jul, 2026" in the layout). */
export function formatOrderDate(iso: string) {
  const parts = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')} ${get('month')} ${get('year')}`
}
