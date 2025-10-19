// Minimal global declarations that are safe and non-intrusive.
// Don't redeclare external modules (react/express/etc.) here —
// that would shadow the real types from node_modules.

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    PORT?: string;
    DATABASE_URL?: string;
    POSTGRES_USER?: string;
    POSTGRES_PASSWORD?: string;
    POSTGRES_DB?: string;
  }
}

// Minimal JSX intrinsic elements to avoid editor noise before @types/react is installed.
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: unknown;
  }
}
