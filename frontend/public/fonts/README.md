Put font files here (woff, woff2, ttf). Use @font-face in your CSS to load them.
Example in globals.css:

@font-face {
  font-family: 'MyFont';
  src: url('/fonts/MyFont.woff2') format('woff2');
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}

Then use `font-family: 'MyFont', system-ui, ...;`
