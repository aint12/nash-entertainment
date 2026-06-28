var token = sessionStorage.getItem('token');
var selectedFiles = [];

if (token) showUploadArea();

document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        if (data.token) {
            token = data.token;
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('role', data.role || 'client');
            if (data.role === 'admin') {
                window.location.href = '/admin';
                return;
            }
            showUploadArea();
        } else {
            document.getElementById('loginError').style.display = 'block';
        }
    })
    .catch(function () {
        document.getElementById('loginError').style.display = 'block';
    });
});

function showUploadArea() {
    document.getElementById('loginArea').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('portalTabs').classList.add('active');
    document.getElementById('logoutBtn').style.display = 'inline';
    loadDeliveries();
}

// Tab switching
document.querySelectorAll('.portal-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
        document.querySelectorAll('.portal-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var target = tab.dataset.tab;
        document.getElementById('uploadArea').style.display = target === 'upload' ? 'block' : 'none';
        document.getElementById('downloadArea').style.display = target === 'downloads' ? 'block' : 'none';
        if (target === 'downloads') loadDeliveries();
    });
});

// Downloads
function loadDeliveries() {
    var list = document.getElementById('downloadList');
    list.innerHTML = '<p class="download-empty">Loading...</p>';

    fetch('/api/deliveries', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(function (res) {
        if (res.status === 401) {
            alert('Session expired. Please log in again.');
            sessionStorage.removeItem('token');
            location.reload();
            return;
        }
        return res.json();
    })
    .then(function (files) {
        if (!files || files.length === 0) {
            list.innerHTML = '<p class="download-empty">No files available for download yet.</p>';
            return;
        }
        list.innerHTML = '';
        files.forEach(function (file) {
            var div = document.createElement('div');
            div.className = 'download-item';
            var date = new Date(file.modified).toLocaleDateString();
            div.innerHTML =
                '<div class="download-info">' +
                    '<div class="download-name">' + escapeHtml(file.name) + '</div>' +
                    '<div class="download-meta">' + formatSize(file.size) + ' &middot; ' + date + '</div>' +
                '</div>' +
                '<button class="download-btn" data-file="' + escapeHtml(file.path) + '">Download</button>';
            list.appendChild(div);
        });
        list.querySelectorAll('.download-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var filePath = this.dataset.file;
                var link = document.createElement('a');
                link.href = '/api/deliveries/download?file=' + encodeURIComponent(filePath);
                link.setAttribute('download', '');
                var xhr = new XMLHttpRequest();
                xhr.open('HEAD', link.href);
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                xhr.send();
                // Use fetch for auth'd download
                fetch(link.href, { headers: { 'Authorization': 'Bearer ' + token } })
                .then(function (res) { return res.blob(); })
                .then(function (blob) {
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = filePath.split('/').pop();
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            });
        });
    })
    .catch(function () {
        list.innerHTML = '<p class="download-empty">Failed to load files. Please try again.</p>';
    });
}

document.getElementById('logoutBtn').addEventListener('click', function (e) {
    e.preventDefault();
    sessionStorage.removeItem('token');
    location.reload();
});

var dropZone = document.getElementById('dropZone');
var fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', function () { fileInput.click(); });

dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', function () {
    dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', function () {
    addFiles(fileInput.files);
    fileInput.value = '';
});

function addFiles(fileListObj) {
    for (var i = 0; i < fileListObj.length; i++) {
        selectedFiles.push(fileListObj[i]);
    }
    renderFileList();
}

function renderFileList() {
    var container = document.getElementById('fileList');
    container.innerHTML = '';
    selectedFiles.forEach(function (file, idx) {
        var div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML =
            '<span class="name">' + escapeHtml(file.name) + '</span>' +
            '<span class="size">' + formatSize(file.size) + '</span>' +
            '<button class="remove" data-idx="' + idx + '">&times;</button>';
        container.appendChild(div);
    });
    document.getElementById('uploadBtn').disabled = selectedFiles.length === 0;

    container.querySelectorAll('.remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
            selectedFiles.splice(parseInt(this.dataset.idx), 1);
            renderFileList();
        });
    });
}

document.getElementById('uploadBtn').addEventListener('click', function () {
    if (selectedFiles.length === 0) return;
    uploadFiles();
});

function uploadFiles() {
    var bar = document.getElementById('progressBar');
    var fill = document.getElementById('progressFill');
    var text = document.getElementById('progressText');
    var btn = document.getElementById('uploadBtn');
    var success = document.getElementById('uploadSuccess');

    bar.style.display = 'block';
    btn.disabled = true;
    success.style.display = 'none';

    var totalSize = selectedFiles.reduce(function (sum, f) { return sum + f.size; }, 0);
    var uploaded = 0;
    var fileIndex = 0;
    var message = document.getElementById('uploadMessage').value;

    function uploadNext() {
        if (fileIndex >= selectedFiles.length) {
            fill.style.width = '100%';
            text.textContent = 'Complete!';
            success.style.display = 'block';
            selectedFiles = [];
            renderFileList();
            document.getElementById('uploadMessage').value = '';
            setTimeout(function () { bar.style.display = 'none'; }, 3000);
            return;
        }

        var file = selectedFiles[fileIndex];
        var chunkSize = 5 * 1024 * 1024; // 5MB chunks
        var offset = 0;
        var totalChunks = Math.ceil(file.size / chunkSize);
        var chunkIndex = 0;

        function uploadChunk() {
            var chunk = file.slice(offset, offset + chunkSize);
            var formData = new FormData();
            formData.append('chunk', chunk);
            formData.append('filename', file.name);
            formData.append('chunkIndex', chunkIndex);
            formData.append('totalChunks', totalChunks);
            if (message && chunkIndex === 0 && fileIndex === 0) {
                formData.append('message', message);
            }

            fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData
            })
            .then(function (res) {
                if (res.status === 401) {
                    alert('Session expired. Please log in again.');
                    sessionStorage.removeItem('token');
                    location.reload();
                    return;
                }
                if (!res.ok) throw new Error('Upload failed');

                uploaded += chunk.size;
                var pct = Math.min(100, Math.round((uploaded / totalSize) * 100));
                fill.style.width = pct + '%';
                text.textContent = 'Uploading ' + escapeHtml(file.name) + '... ' + pct + '%';

                offset += chunkSize;
                chunkIndex++;
                if (offset < file.size) {
                    uploadChunk();
                } else {
                    fileIndex++;
                    uploadNext();
                }
            })
            .catch(function () {
                text.textContent = 'Upload failed. Please try again.';
                btn.disabled = false;
            });
        }

        uploadChunk();
    }

    uploadNext();
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
