// Inline script that runs before hydration to set the dark class.
// The app currently uses dark-only styling, so this always keeps `dark` on <html>.
// Saved here for when full light mode is implemented.
export default function ThemeScript() {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('p3-theme');
        // Default to dark; only remove dark class when explicitly set to light
        if (theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      } catch (e) {}
    })();
  `
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
