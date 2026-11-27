import {copyFileSync} from 'node:fs';

for (const fileName of ['ai-job-hunting.user.js', 'ai-job-hunting.bundle.user.js']) {
    copyFileSync(new URL(`../dist/${fileName}`, import.meta.url), new URL(`../../${fileName}`, import.meta.url));
}
