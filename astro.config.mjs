// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  site: 'https://greekhandy.gr',
  redirects: {
    // QA Wave-2: singular/plural + transliteration aliases for key category routes
    '/ilektrologos': '/ilektrologoi',
    '/ilektrologi': '/ilektrologoi',
    '/ydravlikos': '/ydravlikoi',
    '/ydravliki': '/ydravlikoi',
    '/elaiokhrwmatistis': '/elaiokhrwmatistes',
    '/elaioxromatistis': '/elaiokhrwmatistes',
    '/katharismos': '/katharismoi',
    '/katharistes': '/katharismoi',
    '/katharistries': '/katharismoi',
    '/klimatismos': '/techniki-klimatismou',
    '/klimatistika': '/techniki-klimatismou'
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
