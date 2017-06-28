/// <reference path="./winrtrefs.d.ts"/>
namespace pxt.winrt {
    export function promisify<T>(p: Windows.Foundation.IAsyncOperation<T> | Windows.Foundation.Projections.Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            p.done(v => resolve(v), e => reject(e));
        })
    }

    export function toArray<T>(v: any): T[] {
        let r: T[] = [];
        let length = v.length;
        for (let i = 0; i < length; ++i) r.push(v[i])
        return r;
    }

    /**
     * Detects if the script is running in a browser on windows
     */
    export function isWindows(): boolean {
        return !!navigator && /Win32/i.test(navigator.platform);
    }

    export function isWinRT(): boolean {
        return typeof Windows !== "undefined";
    }

    export function initAsync(importHexImpl?: (hex: pxt.cpp.HexFile, createNewIfFailed?: boolean) => void) {
        if (!isWinRT()) return Promise.resolve();

        initSerial();
        return initialActivationPromise
            .then((args) => {
                if (args && args.kind === Windows.ApplicationModel.Activation.ActivationKind.file) {
                    hasActivationProject = true;
                }
                if (importHexImpl) {
                    importHex = importHexImpl;
                    const app = Windows.UI.WebUI.WebUIApplication as any;
                    app.removeEventListener("activated", initialActivationHandler);
                    app.addEventListener("activated", fileActivationHandler);
                }
            });
    }

    // Needed for when user double clicks a hex file without the app already running
    export function captureInitialActivation() {
        if (!isWinRT()) {
            return;
        }
        (Windows.UI.WebUI.WebUIApplication as any).addEventListener("activated", initialActivationHandler);
    }

    export function loadActivationProject() {
        return initialActivationPromise
            .then((args) => fileActivationHandler(args, /* createNewIfFailed */ true));
    }

    export let hasActivationProject = false;

    function initialActivationHandler(args: Windows.ApplicationModel.Activation.IActivatedEventArgs) {
        (Windows.UI.WebUI.WebUIApplication as any).removeEventListener("activated", initialActivationHandler);
        resolveInitialActivationPromise(args);
    }

    const initialActivationPromise = new Promise<Windows.ApplicationModel.Activation.IActivatedEventArgs>((resolve, reject) => {
        resolveInitialActivationPromise = resolve;
        // After a few seconds, consider we missed the initial activation event and ignore any double clicked file
        setTimeout(() => resolve(null), 3500);
    });
    let resolveInitialActivationPromise: (args: Windows.ApplicationModel.Activation.IActivatedEventArgs) => void;
    let importHex: (hex: pxt.cpp.HexFile, createNewIfFailed?: boolean) => void;

    function fileActivationHandler(args: Windows.ApplicationModel.Activation.IActivatedEventArgs, createNewIfFailed = false) {
        if (args.kind === Windows.ApplicationModel.Activation.ActivationKind.file) {
            let info = args as Windows.UI.WebUI.WebUIFileActivatedEventArgs;
            let file: Windows.Storage.IStorageItem = info.files.getAt(0);
            if (file && file.isOfType(Windows.Storage.StorageItemTypes.file)) {
                let f = file as Windows.Storage.StorageFile;
                Windows.Storage.FileIO.readBufferAsync(f)
                    .then(buffer => {
                        let ar: number[] = [];
                        let dataReader = Windows.Storage.Streams.DataReader.fromBuffer(buffer);
                        while (dataReader.unconsumedBufferLength) {
                            ar.push(dataReader.readByte());
                        }
                        dataReader.close();
                        return pxt.cpp.unpackSourceFromHexAsync(new Uint8Array(ar));
                    })
                    .then((hex) => importHex(hex, createNewIfFailed));
            }
        }
    }
}