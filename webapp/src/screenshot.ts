import * as workspace from "./workspace";
import * as data from "./data";

type Header = pxt.workspace.Header;

const ICON_WIDTH = 305;
const ICON_HEIGHT = 200;

function renderIcon(img: HTMLImageElement): string {
    let icon: string = null;
    if (img && img.width > 0 && img.height > 0) {
        const cvs = document.createElement("canvas") as HTMLCanvasElement;
        cvs.width = ICON_WIDTH;
        cvs.height = ICON_HEIGHT;
        let ox = 0;
        let oy = 0;
        let iw = 0;
        let ih = 0;
        if (img.height > img.width) {
            ox = 0;
            iw = img.width;
            ih = iw / cvs.width * cvs.height;
            oy = (img.height - ih) / 2;
        } else {
            oy = 0;
            ih = img.height;
            iw = ih / cvs.height * cvs.width;
            ox = (img.width - iw) / 2;
        }
        const ctx = cvs.getContext("2d");
        ctx.drawImage(img, ox, oy, iw, ih, 0, 0, cvs.width, cvs.height);
        icon = cvs.toDataURL('image/jpeg', 85);
    }
    return icon;
}

interface IGIF {
    addFrame(img: HTMLImageElement): void;
    on(ev: string, handler: (blob: Blob) => void): void;
    render(): void;
};

// https://github.com/jnordberg/gif.js
let recorder: IGIF = undefined; // GIF
let iconRecorder: IGIF = undefined; // GIF

function renderAsync(rec: IGIF): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        rec.on('finished', blob => {
            const buri = URL.createObjectURL(blob);
            resolve(buri);
        })
        rec.render();
    });
}

export function addFrameAsync(uri: string): Promise<void> {
    if (!recorder) {
        recorder = new (window as any).GIF({
            workerScript: pxt.webConfig.pxtCdnUrl + "gifjs/gif.worker.js",
            workers: 1,
            repeat: 0
        });
        iconRecorder = new (window as any).GIF({
            workerScript: pxt.webConfig.pxtCdnUrl + "gifjs/gif.worker.js",
            workers: 1,
            repeat: 0,
            width: ICON_WIDTH,
            height: ICON_HEIGHT
        });
    }

    const rec = recorder;
    const irec = iconRecorder;
    return pxt.BrowserUtils.loadImageAsync(uri)
        .then((img) => {
            if (img) {
                rec.addFrame(img);
                irec.addFrame(img);
            }
        });
}

export function stopRecording(header: Header, filename: string) {
    const rec = recorder;
    const irec = iconRecorder;
    recorder = undefined;
    iconRecorder = undefined;

    if (!rec || !irec) return;

    Promise.all([renderAsync(rec), renderAsync(irec)])
        .done(urls => {
            if (!urls || urls.some(url => !url)) return;

            pxt.BrowserUtils.browserDownloadDataUri(
                urls[0],
                filename);
            workspace.saveScreenshotAsync(header, urls[0], urls[1])
                .delay(3000)
                .then(() => urls.forEach(url => URL.revokeObjectURL(url)));
        })
}

export function saveAsync(header: Header, screenshot: string): Promise<void> {
    return pxt.BrowserUtils.loadImageAsync(screenshot)
        .then(img => {
            const icon = renderIcon(img);
            return workspace.saveScreenshotAsync(header, screenshot, icon)
                .then(() => {
                    data.invalidate("header:" + header.id);
                    data.invalidate("header:*");
                });
        });
}
