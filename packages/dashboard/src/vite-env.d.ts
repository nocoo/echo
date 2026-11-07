/// <reference types="vite/client" />

declare const __ECHO_VERSION__: string;

declare module "*.png" {
  const src: string;
  export default src;
}
