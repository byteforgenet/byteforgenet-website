document.addEventListener('DOMContentLoaded', () => {
    const socket = io('http://localhost:3000');

    // Initialize Fabric Canvas
    const canvas = new fabric.Canvas('whiteboard', {
        isDrawingMode: false,
        backgroundColor: '#ffffff',
        width: window.innerWidth - 260, // Sidebar width
        height: window.innerHeight - 100 // Topbar height
    });

    // Make canvas resize dynamically
    window.addEventListener('resize', () => {
        canvas.setWidth(window.innerWidth - 260);
        canvas.setHeight(window.innerHeight - 100);
        canvas.renderAll();
    });

    const boardId = 'global-board'; // For now, everyone joins the same board
    socket.emit('join-board', boardId);

    // Toolbar buttons
    const btnSelect = document.getElementById('btn-select');
    const btnDraw = document.getElementById('btn-draw');
    const btnRect = document.getElementById('btn-rect');
    const btnCircle = document.getElementById('btn-circle');
    const btnText = document.getElementById('btn-text');
    const btnClear = document.getElementById('btn-clear');
    const colorPicker = document.getElementById('color-picker');

    let currentMode = 'select';
    let drawsFromRemote = false; // Flag to prevent infinite echo loops

    function setMode(mode, button) {
        currentMode = mode;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        if (button) button.classList.add('active');

        canvas.isDrawingMode = (mode === 'draw');
        if (mode === 'draw') {
            canvas.freeDrawingBrush.color = colorPicker.value;
            canvas.freeDrawingBrush.width = 3;
        }
    }

    btnSelect.addEventListener('click', () => setMode('select', btnSelect));
    btnDraw.addEventListener('click', () => setMode('draw', btnDraw));

    colorPicker.addEventListener('change', (e) => {
        if (canvas.isDrawingMode) {
            canvas.freeDrawingBrush.color = e.target.value;
        }
    });

    btnRect.addEventListener('click', () => {
        setMode('select', btnSelect); // Revert to select after adding
        const rect = new fabric.Rect({
            left: canvas.width / 2 - 50,
            top: canvas.height / 2 - 50,
            fill: 'transparent',
            stroke: colorPicker.value,
            strokeWidth: 3,
            width: 100,
            height: 100,
            id: generateId()
        });
        canvas.add(rect);
        canvas.setActiveObject(rect);
        emitCanvasAction({ action: 'add', object: rect.toJSON(['id']) });
    });

    btnCircle.addEventListener('click', () => {
        setMode('select', btnSelect);
        const circle = new fabric.Circle({
            left: canvas.width / 2 - 50,
            top: canvas.height / 2 - 50,
            fill: 'transparent',
            stroke: colorPicker.value,
            strokeWidth: 3,
            radius: 50,
            id: generateId()
        });
        canvas.add(circle);
        canvas.setActiveObject(circle);
        emitCanvasAction({ action: 'add', object: circle.toJSON(['id']) });
    });

    btnText.addEventListener('click', () => {
        setMode('select', btnSelect);
        const text = new fabric.IText('Double click to edit', {
            left: canvas.width / 2,
            top: canvas.height / 2,
            fill: colorPicker.value,
            fontSize: 24,
            fontFamily: 'sans-serif',
            id: generateId()
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        emitCanvasAction({ action: 'add', object: text.toJSON(['id']) });
    });

    btnClear.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the entire whiteboard?')) {
            canvas.clear();
            canvas.backgroundColor = '#ffffff';
            emitCanvasAction({ action: 'clear' });
        }
    });

    // Handle user drawing lines (Free drawing)
    canvas.on('path:created', (e) => {
        if (drawsFromRemote) return;
        const path = e.path;
        path.set({ id: generateId() });
        emitCanvasAction({ action: 'add', object: path.toJSON(['id']) });
    });

    // Handle object moving/scaling/rotating
    canvas.on('object:modified', (e) => {
        if (drawsFromRemote) return;
        emitCanvasAction({ action: 'modify', object: e.target.toJSON(['id']) });
    });

    // --- SOCKET.IO EVENT LISTENERS ---

    function emitCanvasAction(data) {
        socket.emit('canvas-action', { boardId, ...data });
    }

    socket.on('canvas-action', (data) => {
        drawsFromRemote = true; // Prevent echo

        switch (data.action) {
            case 'clear':
                canvas.clear();
                canvas.backgroundColor = '#ffffff';
                break;
            case 'add':
                fabric.util.enlivenObjects([data.object], (objects) => {
                    const obj = objects[0];
                    canvas.add(obj);
                    canvas.renderAll();
                });
                break;
            case 'modify':
                // Find existing object by ID and update it
                const existingObj = canvas.getObjects().find(o => o.id === data.object.id);
                if (existingObj) {
                    existingObj.set(data.object);
                } else {
                    // Fallback if not found locally for some reason
                    fabric.util.enlivenObjects([data.object], (objects) => {
                        const obj = objects[0];
                        canvas.add(obj);
                    });
                }
                canvas.renderAll();
                break;
        }

        drawsFromRemote = false;
    });

    function generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
});
