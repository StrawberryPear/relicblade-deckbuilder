// PDF Card Extractor
// app.js part 1/3

let pdfjsLib;

const state = {
    files: [],
    pdfs: [],
    previewPdf: null,
    previewPage: null,
    previewCanvas: null,
    cards: [],
    settings: {
        offsetX: 147,
        offsetY: 75,
        cardWidth: 720,
        cardHeight: 1000,
        columns: 3,
        rows: 3,
        rowDrift: 10,
        scale: 4.0,
        skipBlank: true
    }
};

const elements = {
    dropZone: document.getElementById("dropZone"),
    fileInput: document.getElementById("fileInput"),

    offsetX: document.getElementById("offsetX"),
    offsetY: document.getElementById("offsetY"),
    cardWidth: document.getElementById("cardWidth"),
    cardHeight: document.getElementById("cardHeight"),
    columns: document.getElementById("columns"),
    rows: document.getElementById("rows"),
    rowDrift: document.getElementById("rowDrift"),
    scale: document.getElementById("scale"),

    skipBlank: document.getElementById("skipBlank"),

    previewBtn: document.getElementById("previewBtn"),
    exportBtn: document.getElementById("exportBtn"),

    previewCanvas: document.getElementById("previewCanvas"),

    progressInner: document.getElementById("progressInner"),
    status: document.getElementById("status"),
    fileList: document.getElementById("fileList")
};


async function initPdfJs() {

    if (pdfjsLib)
        return;

    pdfjsLib = await import(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs"
    );

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs";
}


function readSettings() {

    state.settings.offsetX = Number(elements.offsetX.value);
    state.settings.offsetY = Number(elements.offsetY.value);
    state.settings.cardWidth = Number(elements.cardWidth.value);
    state.settings.cardHeight = Number(elements.cardHeight.value);
    state.settings.columns = Number(elements.columns.value);
    state.settings.rows = Number(elements.rows.value);
    state.settings.rowDrift = Number(elements.rowDrift.value);
    state.settings.scale = Number(elements.scale.value);
    state.settings.skipBlank = elements.skipBlank.checked;
}


function updateStatus(text) {
    elements.status.textContent = text;
}


function updateProgress(value) {
    elements.progressInner.style.width =
        `${Math.min(100, Math.max(0, value))}%`;
}


function addFiles(files) {

    state.files = [...files];

    elements.fileList.innerHTML = "";

    for (const file of state.files) {

        const div = document.createElement("div");
        div.textContent = file.name;
        elements.fileList.appendChild(div);
    }

    elements.exportBtn.disabled = false;

    updateStatus(`${state.files.length} PDFs loaded.`);
}


elements.dropZone.onclick = () => {
    elements.fileInput.click();
};


elements.fileInput.onchange = e => {
    addFiles(e.target.files);
};


elements.dropZone.ondragover = e => {
    e.preventDefault();
    elements.dropZone.classList.add("drag");
};


elements.dropZone.ondragleave = () => {
    elements.dropZone.classList.remove("drag");
};


elements.dropZone.ondrop = e => {

    e.preventDefault();

    elements.dropZone.classList.remove("drag");

    addFiles(e.dataTransfer.files);
};


async function loadPdf(file) {

    await initPdfJs();

    const buffer = await file.arrayBuffer();

    return await pdfjsLib.getDocument({
        data: buffer
    }).promise;
}


async function renderPage(pdf, pageNumber = 1, scale = state.settings.scale) {

    const page = await pdf.getPage(pageNumber);

    const viewport =
        page.getViewport({scale});

    const canvas = document.createElement("canvas");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");

    await page.render({
        canvasContext: ctx,
        viewport
    }).promise;

    return canvas;
}


function getCropRect(index) {

    const {
        offsetX,
        offsetY,
        cardWidth,
        cardHeight,
        columns,
        rowDrift
    } = state.settings;


    const row = Math.floor(index / columns);
    const col = index % columns;


    return {
        x: offsetX + cardWidth * col,
        y: offsetY + cardHeight * row + rowDrift * row,
        width: cardWidth,
        height: cardHeight
    };
}


function drawPreview(canvas) {

    const preview = elements.previewCanvas;

    const ctx = preview.getContext("2d");

    const scale = Math.min(
        900 / canvas.width,
        900 / canvas.height
    );


    preview.width = canvas.width * scale;
    preview.height = canvas.height * scale;


    ctx.drawImage(
        canvas,
        0,
        0,
        preview.width,
        preview.height
    );


    ctx.lineWidth = 3;
    ctx.strokeStyle = "red";


    const count =
        state.settings.rows *
        state.settings.columns;


    for (let i = 0; i < count; i++) {

        const r = getCropRect(i);

        ctx.strokeRect(
            r.x * scale,
            r.y * scale,
            r.width * scale,
            r.height * scale
        );


        ctx.fillStyle = "red";
        ctx.fillText(
            String(i),
            r.x * scale + 8,
            r.y * scale + 20
        );
    }
}


elements.previewBtn.onclick = async () => {

    if (!state.files.length)
        return;


    readSettings();

    updateStatus("Rendering preview...");


    const pdf = await loadPdf(state.files[0]);

    state.previewPdf = pdf;

    const canvas =
        await renderPage(pdf, 1);


    state.previewCanvas = canvas;

    drawPreview(canvas);

    updateStatus(
        `Preview: ${state.files[0].name}`
    );
};


[
    elements.offsetX,
    elements.offsetY,
    elements.cardWidth,
    elements.cardHeight,
    elements.columns,
    elements.rows,
    elements.rowDrift,
    elements.scale,
    elements.skipBlank
].forEach(el => {

    el.onchange = () => {

        readSettings();

        if (state.previewCanvas)
            drawPreview(state.previewCanvas);
    };
});

// app.js part 2/3


function isBlack(pixelData, width, x, y) {

    const i = (y * width + x) * 4;

    return (
        pixelData[i] +
        pixelData[i + 1] +
        pixelData[i + 2]
    ) < 15;
}


function hasBorder(canvas, rect) {

    const ctx = canvas.getContext("2d");

    const data = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    ).data;


    let blackCount = 0;

    const x = Math.floor(rect.x);
    const y = Math.floor(rect.y);
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);


    function safeBlack(px, py) {

        if (
            px < 0 ||
            py < 0 ||
            px >= canvas.width ||
            py >= canvas.height
        )
            return false;

        return isBlack(
            data,
            canvas.width,
            px,
            py
        );
    }


    for (let i = 0; i < w; i++) {

        blackCount +=
            safeBlack(x + i, y + 5)
            ? 1
            : 0;

        blackCount +=
            safeBlack(x + i, y + h - 6)
            ? 1
            : 0;
    }


    for (let i = 0; i < h; i++) {

        blackCount +=
            safeBlack(x + 5, y + i)
            ? 1
            : 0;

        blackCount +=
            safeBlack(x + w - 6, y + i)
            ? 1
            : 0;
    }


    return (
        blackCount >
        (w * 2 + h * 2) * 0.75
    );
}



function cropCanvas(source, rect) {

    const canvas =
        document.createElement("canvas");


    canvas.width = state.settings.cardWidth;
    canvas.height = state.settings.cardHeight;


    const ctx =
        canvas.getContext("2d");


    ctx.drawImage(
        source,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        canvas.width,
        canvas.height
    );


    return canvas;
}

async function canvasToBlob(canvas) {
    const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
    const ctx = offscreen.getContext("2d");
    ctx.drawImage(canvas, 0, 0);
    return await offscreen.convertToBlob({ type: "image/jpeg", quality: 0.86 });
}
async function resizeCardBlob(blob) {
    const bitmap = await createImageBitmap(blob);
    const offscreen = new OffscreenCanvas(720, 1000);
    const ctx = offscreen.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, 720, 1000);
    bitmap.close();
    return await offscreen.convertToBlob({ type: "image/jpeg", quality: 0.86 });
}


async function extractPageCards(canvas, filename, cardOffset = 0) {

    const results = [];


    const count =
        state.settings.rows *
        state.settings.columns;


    for (let i = 0; i < count; i++) {
        console.log(`Extracting card ${i + 1}/${count} from ${filename}`);


        const rect =
            getCropRect(i);

        console.log(`Crop rectangle: x=${rect.x}, y=${rect.y}, width=${rect.width}, height=${rect.height}`);

        if (
            state.settings.skipBlank &&
            !hasBorder(canvas, rect)
        ) {

            continue;
        }


        const cardCanvas =
            cropCanvas(
                canvas,
                rect
            );


        console.log(`Cropped card canvas: width=${cardCanvas.width}, height=${cardCanvas.height}`);

        const blob =
            await canvasToBlob(
                cardCanvas
            );

        console.log(`Created blob for card ${i + 1}: size=${blob.size} bytes`);

        results.push({

            filename: `${filename} - ${(cardOffset + results.length)}.jpg`,

            blob,

            index:i
        });


        await new Promise(
            r => requestAnimationFrame(r)
        );
    }


    return results;
}

async function processPdf(file) {
    const pdf = await loadPdf(file);
    const output = [];
    let cardOffset = 0;

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        updateStatus(`${file.name}: rendering page ${pageNo}/${pdf.numPages}`);
        const canvas = await renderPage(pdf, pageNo, state.settings.scale);
        const cards = await extractPageCards(canvas, file.name.replace(/\.pdf$/i, ""), cardOffset);  // ← pass it
        cardOffset += cards.length;  // ← increment by actual cards found (respects skipBlank)
        output.push(...cards);

        canvas.width = 0;
        canvas.height = 0;
        updateProgress((pageNo / pdf.numPages) * 100);
    }

    return output;
}



async function createZip(cards) {


    const zip =
        new JSZip();


    for (const card of cards) {

        zip.file(
            card.filename,
            card.blob
        );
    }


    return await zip.generateAsync({
        type:"blob"
    });
}


async function exportAll() {
    if (!state.files.length) return;
    readSettings();
    elements.exportBtn.disabled = true;
    updateProgress(0);

    const zip = new JSZip();  // create ZIP once, upfront
    let totalCards = 0;
    let processed = 0;

    for (const file of state.files) {
        updateStatus(`Processing ${file.name}`);
        const cards = await processPdf(file);

        for (const card of cards) {
            zip.file(card.filename, card.blob);  // add to zip...
            card.blob = null;                     // ...then release the blob
            totalCards++;
        }

        processed++;
        updateProgress((processed / state.files.length) * 100);
    }

    updateStatus(`Creating ZIP (${totalCards} cards)...`);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, "cards.zip");
    updateStatus(`Done: ${totalCards} cards exported`);
    elements.exportBtn.disabled = false;
}


elements.exportBtn.onclick =
    exportAll;

    // app.js part 3/3


//
// Final helpers / fixes
//


// Override the earlier crop export to ensure
// final dimensions are always correct.
const originalCanvasToBlob = canvasToBlob;


canvasToBlob = async function(canvas) {

    const blob =
        await originalCanvasToBlob(canvas);


    return await resizeCardBlob(blob);
};



// Re-render preview automatically when sliders change.
// Useful when changing offsets while inspecting a PDF.
function refreshPreview() {

    if (!state.previewCanvas)
        return;

    readSettings();

    drawPreview(
        state.previewCanvas
    );
}


[
    elements.offsetX,
    elements.offsetY,
    elements.cardWidth,
    elements.cardHeight,
    elements.columns,
    elements.rows,
    elements.rowDrift
].forEach(element => {

    element.addEventListener(
        "input",
        refreshPreview
    );

});



// Handle PDF page dimensions.
// Some PDFs have transparent areas,
// so use a white background.
const originalRenderPage =
    renderPage;


renderPage = async function(
    pdf,
    pageNumber = 1,
    scale = state.settings.scale
) {

    const canvas =
        await originalRenderPage(
            pdf,
            pageNumber,
            scale
        );


    const fixed =
        document.createElement("canvas");


    fixed.width = canvas.width;
    fixed.height = canvas.height;


    const ctx =
        fixed.getContext("2d");


    ctx.fillStyle = "white";
    ctx.fillRect(
        0,
        0,
        fixed.width,
        fixed.height
    );


    ctx.drawImage(
        canvas,
        0,
        0
    );


    return fixed;
};



// Show a useful warning if crop settings
// exceed the PDF page.
function validateCropArea(canvas) {

    const maxX =
        state.settings.offsetX +
        state.settings.cardWidth *
        state.settings.columns;


    const maxY =
        state.settings.offsetY +
        state.settings.cardHeight *
        state.settings.rows +
        state.settings.rowDrift *
        (state.settings.rows - 1);


    if (
        maxX > canvas.width ||
        maxY > canvas.height
    ) {

        updateStatus(
            "Warning: crop area exceeds PDF page size"
        );

        return false;
    }


    return true;
}



// Patch preview button to include validation.
elements.previewBtn.onclick =
async function() {

    if (!state.files.length)
        return;


    readSettings();


    updateStatus(
        "Rendering preview..."
    );


    const pdf =
        await loadPdf(
            state.files[0]
        );


    state.previewPdf = pdf;


    const canvas =
        await renderPage(
            pdf,
            1
        );


    state.previewCanvas =
        canvas;


    validateCropArea(canvas);


    drawPreview(canvas);


    updateStatus(
        `Preview: ${state.files[0].name}`
    );
};



// Initial UI state
updateProgress(0);

updateStatus(
    "Drop PDFs to begin."
);