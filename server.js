var express = require('express');
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var app = express();
var PORT = 4000;

var JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret-in-production';

var USERS_FILE = path.join(__dirname, 'users.json');
if (!fs.existsSync(USERS_FILE)) {
    var adminHash = bcrypt.hashSync('nash2026admin', 10);
    var clientHash = bcrypt.hashSync('nashclient2026', 10);
    fs.writeFileSync(USERS_FILE, JSON.stringify([
        { username: 'admin', password: adminHash, role: 'admin' },
        { username: 'client', password: clientHash, role: 'client' }
    ], null, 2));
    console.log('Created default admin  — username: admin / password: nash2026admin');
    console.log('Created default client — username: client / password: nashclient2026');
}

var UPLOADS_DIR = path.join(__dirname, 'client-uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

var DELIVERIES_DIR = path.join(__dirname, 'client-deliveries');
if (!fs.existsSync(DELIVERIES_DIR)) fs.mkdirSync(DELIVERIES_DIR, { recursive: true });

var QUOTES_FILE = path.join(__dirname, 'quotes.json');
if (!fs.existsSync(QUOTES_FILE)) fs.writeFileSync(QUOTES_FILE, '[]');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/portal', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

app.get('/admin', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/api/login', function (req, res) {
    var body = req.body;
    var users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    var user = users.find(function (u) { return u.username === body.username; });

    if (!user || !bcrypt.compareSync(body.password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    var token = jwt.sign({ username: user.username, role: user.role || 'client' }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token: token, role: user.role || 'client' });
});

function authMiddleware(req, res, next) {
    var header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        var decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).json({ error: 'Token expired' });
    }
}

var upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            var userDir = path.join(UPLOADS_DIR, req.user.username, new Date().toISOString().slice(0, 10));
            fs.mkdirSync(userDir, { recursive: true });
            cb(null, userDir);
        },
        filename: function (req, file, cb) {
            var safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            cb(null, req.body.chunkIndex + '_' + safeName);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/api/upload', authMiddleware, upload.single('chunk'), function (req, res) {
    var chunkIndex = parseInt(req.body.chunkIndex);
    var totalChunks = parseInt(req.body.totalChunks);
    var filename = req.body.filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (req.body.message && chunkIndex === 0) {
        var userDir = path.join(UPLOADS_DIR, req.user.username, new Date().toISOString().slice(0, 10));
        fs.writeFileSync(path.join(userDir, '_message.txt'), req.body.message);
    }

    if (chunkIndex === totalChunks - 1) {
        var dir = path.dirname(req.file.path);
        var finalPath = path.join(dir, filename);
        var writeStream = fs.createWriteStream(finalPath);

        var i = 0;
        function mergeNext() {
            var chunkPath = path.join(dir, i + '_' + filename);
            if (i >= totalChunks) {
                writeStream.end();
                console.log('Upload complete: ' + filename + ' by ' + req.user.username);
                return;
            }
            if (fs.existsSync(chunkPath)) {
                var readStream = fs.createReadStream(chunkPath);
                readStream.pipe(writeStream, { end: false });
                readStream.on('end', function () {
                    fs.unlinkSync(chunkPath);
                    i++;
                    mergeNext();
                });
            } else {
                i++;
                mergeNext();
            }
        }
        mergeNext();
    }

    res.json({ ok: true });
});

app.get('/api/deliveries', authMiddleware, function (req, res) {
    var userDir = path.join(DELIVERIES_DIR, req.user.username);
    if (!fs.existsSync(userDir)) return res.json([]);

    var files = [];
    function walk(dir, prefix) {
        var entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach(function (entry) {
            if (entry.name.startsWith('.') || entry.name.startsWith('_')) return;
            var fullPath = path.join(dir, entry.name);
            var relativePath = prefix ? prefix + '/' + entry.name : entry.name;
            if (entry.isDirectory()) {
                walk(fullPath, relativePath);
            } else {
                var stat = fs.statSync(fullPath);
                files.push({
                    name: entry.name,
                    path: relativePath,
                    size: stat.size,
                    modified: stat.mtime.toISOString()
                });
            }
        });
    }
    walk(userDir, '');
    files.sort(function (a, b) { return b.modified.localeCompare(a.modified); });
    res.json(files);
});

app.get('/api/deliveries/download', authMiddleware, function (req, res) {
    var filePath = req.query.file;
    if (!filePath) return res.status(400).json({ error: 'Missing file parameter' });

    var safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    var fullPath = path.join(DELIVERIES_DIR, req.user.username, safePath);

    if (!fullPath.startsWith(path.join(DELIVERIES_DIR, req.user.username))) {
        return res.status(403).json({ error: 'Access denied' });
    }
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });

    res.download(fullPath);
});

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
}

app.get('/api/admin/clients', authMiddleware, adminOnly, function (req, res) {
    var users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    var clients = users.filter(function (u) { return u.role !== 'admin'; }).map(function (u) {
        var deliveryDir = path.join(DELIVERIES_DIR, u.username);
        var fileCount = 0;
        if (fs.existsSync(deliveryDir)) {
            (function count(dir) {
                fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
                    if (e.name.startsWith('.') || e.name.startsWith('_')) return;
                    if (e.isDirectory()) count(path.join(dir, e.name));
                    else fileCount++;
                });
            })(deliveryDir);
        }
        return { username: u.username, role: u.role || 'client', deliveryFiles: fileCount };
    });
    res.json(clients);
});

app.post('/api/admin/clients', authMiddleware, adminOnly, function (req, res) {
    var username = (req.body.username || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    var password = req.body.password;
    if (!username || username.length < 2) return res.status(400).json({ error: 'Username must be at least 2 characters (letters, numbers, dashes)' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    var users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (users.find(function (u) { return u.username === username; })) {
        return res.status(409).json({ error: 'Username already exists' });
    }

    users.push({ username: username, password: bcrypt.hashSync(password, 10), role: 'client' });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    fs.mkdirSync(path.join(DELIVERIES_DIR, username), { recursive: true });
    fs.mkdirSync(path.join(UPLOADS_DIR, username), { recursive: true });

    console.log('Admin created client: ' + username);
    res.json({ ok: true, username: username });
});

app.post('/api/admin/clients/reset-password', authMiddleware, adminOnly, function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    var users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    var user = users.find(function (u) { return u.username === username && u.role !== 'admin'; });
    if (!user) return res.status(404).json({ error: 'Client not found' });

    user.password = bcrypt.hashSync(password, 10);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('Admin reset password for: ' + username);
    res.json({ ok: true });
});

app.delete('/api/admin/clients/:username', authMiddleware, adminOnly, function (req, res) {
    var username = req.params.username;
    var users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    var idx = users.findIndex(function (u) { return u.username === username && u.role !== 'admin'; });
    if (idx === -1) return res.status(404).json({ error: 'Client not found' });

    users.splice(idx, 1);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('Admin deleted client: ' + username);
    res.json({ ok: true });
});

app.get('/api/admin/quotes', authMiddleware, adminOnly, function (req, res) {
    var quotes = JSON.parse(fs.readFileSync(QUOTES_FILE, 'utf8'));
    quotes.sort(function (a, b) { return b.date.localeCompare(a.date); });
    res.json(quotes);
});

app.post('/api/quote', function (req, res) {
    var quotes = JSON.parse(fs.readFileSync(QUOTES_FILE, 'utf8'));
    quotes.push({
        date: new Date().toISOString(),
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone || '',
        service: req.body.service,
        budget: req.body.budget || '',
        details: req.body.details
    });
    fs.writeFileSync(QUOTES_FILE, JSON.stringify(quotes, null, 2));
    console.log('New quote request from ' + req.body.name + ' (' + req.body.email + ')');
    res.json({ ok: true });
});

app.listen(PORT, function () {
    console.log('');
    console.log('  Nash Entertainment is running!');
    console.log('  Main site:      http://localhost:' + PORT);
    console.log('  Client portal:  http://localhost:' + PORT + '/portal');
    console.log('');
});
