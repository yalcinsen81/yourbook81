/** Warm school notebook design tokens. Tailwind v4 reads the CSS tokens in src/index.css. */
export default {
  theme: { extend: {
    spacing: { 1:'4px',2:'8px',3:'12px',4:'16px',6:'24px',8:'32px',12:'48px' },
    borderRadius: { sm:'8px', md:'14px', lg:'20px', pill:'999px' },
    boxShadow: { card:'4px 5px 0 color-mix(in srgb, var(--ink) 85%, transparent)' },
    colors: { success:'var(--color-success)', danger:'var(--color-danger)', warning:'var(--color-warning)' },
    fontSize: { xs:'12px', sm:'14px', base:'16px', lg:'20px', '2xl':'28px', '5xl':'40px', '7xl':'56px' }
  }}
};
