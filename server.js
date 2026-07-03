const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'database.json');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readDatabase() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            return { heroTitle: '', advantages: [], teamSection: { title: '', description: '' }, teamMembers: [], brands: [], directions: [], vacancies: [], contactForm: { heading: '', description: '', submitText: '' } };
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        const parsed = JSON.parse(data);
        
        return {
            heroTitle: typeof parsed.heroTitle === 'string' ? parsed.heroTitle : '',
            advantages: Array.isArray(parsed.advantages) ? parsed.advantages : [],
            teamSection: parsed.teamSection && typeof parsed.teamSection === 'object' ? parsed.teamSection : { title: '', description: '' },
            teamMembers: Array.isArray(parsed.teamMembers) ? parsed.teamMembers : [],
            brands: Array.isArray(parsed.brands) ? parsed.brands : [],
            directions: Array.isArray(parsed.directions) ? parsed.directions : [],
            vacancies: Array.isArray(parsed.vacancies) ? parsed.vacancies : [] ,
            contactForm: parsed.contactForm && typeof parsed.contactForm === 'object' ? {
                heading: typeof parsed.contactForm.heading === 'string' ? parsed.contactForm.heading : '',
                description: typeof parsed.contactForm.description === 'string' ? parsed.contactForm.description : '',
                submitText: typeof parsed.contactForm.submitText === 'string' ? parsed.contactForm.submitText : ''
            } : { heading: '', description: '', submitText: '' }
        };
    } catch (error) {
        console.error('Ошибка при чтении файла БД:', error);
        return { heroTitle: '', advantages: [], teamSection: { title: '', description: '' }, teamMembers: [], brands: [], directions: [], vacancies: [], contactForm: { heading: '', description: '', submitText: '' } };
    }
}



function writeDatabase(data) {
    try {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Ошибка при записи в файл БД:', error);
        return false;
    }
}

app.get('/', (req, res) => {
    const db = readDatabase();
    res.render('index', { db });
});

app.get('/admin', (req, res) => {
    const db = readDatabase();
    res.render('admin', { db });
});

// Обработка сохранения изменений из заголовка
app.post('/admin/save-hero', (req, res) => {
    const { heroTitle } = req.body;
    const currentDb = readDatabase();

    const rawText = heroTitle || '';
    currentDb.heroTitle = rawText.trim().replace(/\r?\n/g, '<br>');

    const success = writeDatabase(currentDb);

    if (success) {
        res.redirect('/admin');
    } else {
        res.status(500).send('Ошибка при сохранении данных секции Hero.');
    }
});

// Обработка сохранения изменений из статистики
app.post('/admin/save-advantages', (req, res) => {
    // Получаем плоские массивы от полей с одинаковыми именами
    const { titleText, titleImage, description } = req.body;
    const currentDb = readDatabase();
    currentDb.advantages = [];

    const texts = Array.isArray(titleText) ? titleText : (titleText ? [titleText] : []);
    const images = Array.isArray(titleImage) ? titleImage : (titleImage ? [titleImage] : []);
    const descs = Array.isArray(description) ? description : (description ? [description] : []);

    for (let i = 0; i < texts.length; i++) {
        currentDb.advantages.push({
            titleText: (texts[i] || '').trim(),
            titleImage: (images[i] || '').trim(),
            description: (descs[i] || '').trim()
        });
    }

    const success = writeDatabase(currentDb);
    if (success) {
        res.redirect('/admin');
    } else {
        res.status(500).send('Ошибка при сохранении преимуществ.');
    }
});

// Обработка сохранения изменений секции "Команда"
app.post('/admin/save-team', upload.array('memberFile'), (req, res) => {
    const { section, mName, mPosition, mPhoto } = req.body;
    const currentDb = readDatabase();

    const secTitleRaw = (section && section.title) || '';
    const secDescRaw = (section && section.description) || '';
    currentDb.teamSection = {
        title: secTitleRaw.trim().replace(/\r?\n/g, '<br>'),
        description: secDescRaw.trim().replace(/\r?\n/g, '<br>')
    };

    currentDb.teamMembers = [];
    const names = Array.isArray(mName) ? mName : (mName ? [mName] : []);
    const positions = Array.isArray(mPosition) ? mPosition : (mPosition ? [mPosition] : []);
    const photos = Array.isArray(mPhoto) ? mPhoto : (mPhoto ? [mPhoto] : []);
    const files = req.files || [];

    let fileIndex = 0;

    for (let i = 0; i < names.length; i++) {
        let finalPhotoPath = (photos[i] || '').trim();

        if (req.body[`hasMemberFile_${i}`] === 'true' && files[fileIndex]) {
            finalPhotoPath = '/uploads/' + files[fileIndex].filename;
            fileIndex++;
        }

        currentDb.teamMembers.push({
            name: (names[i] || '').trim().replace(/\r?\n/g, '<br>'),
            position: (positions[i] || '').trim().replace(/\r?\n/g, '<br>'),
            photo: finalPhotoPath
        });
    }

    const success = writeDatabase(currentDb);
    if (success) {
        res.redirect('/admin');
    } else {
        res.status(500).send('Ошибка при сохранении команды.');
    }
});

// Обработка сохранения изменений секции "Клиенты"
app.post('/admin/save-brands', upload.array('brandFile'), (req, res) => {
    const { brandName, brandImage } = req.body;
    const currentDb = readDatabase();
    
    currentDb.brands = [];
    
    const names = Array.isArray(brandName) ? brandName : (brandName ? [brandName] : []);
    const images = Array.isArray(brandImage) ? brandImage : (brandImage ? [brandImage] : []);
    const files = req.files || [];

    let fileIndex = 0;

    for (let i = 0; i < names.length; i++) {
        let finalImagePath = (images[i] || '').trim();

        if (req.body[`hasFile_${i}`] === 'true' && files[fileIndex]) {
            finalImagePath = '/uploads/' + files[fileIndex].filename;
            fileIndex++;
        }

        currentDb.brands.push({
            name: (names[i] || '').trim(),
            image: finalImagePath
        });
    }

    const success = writeDatabase(currentDb);
    if (success) {
        res.redirect('/admin');
    } else {
        res.status(500).send('Ошибка при сохранении брендов.');
    }
});

// Обработка сохранения изменений секции "Направления"
app.post('/admin/save-directions', upload.any(), (req, res) => {
    const { rawData } = req.body;
    const currentDb = readDatabase();
    
    try {
        const parsedDirections = JSON.parse(rawData || '[]');
        const files = req.files || [];

        currentDb.directions = parsedDirections.map(dir => {
            const rawContent = (dir.content || '').trim();
            
            // --- ИНТЕЛЛЕКТУАЛЬНЫЙ ПАРСИНГ ТЕКСТА В HTML ---
            const lines = rawContent.split(/\r?\n/);
            let htmlResult = '';
            let inList = false;

            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return; 

                const isListItem = trimmedLine.startsWith('-') || trimmedLine.startsWith('*');

                if (isListItem) {
                    if (!inList) {
                        htmlResult += '<ul>\n';
                        inList = true;
                    }
                    const cleanText = trimmedLine.replace(/^[-*]\s*/, '');
                    htmlResult += `    <li>${cleanText}</li>\n`;
                } else {
                    if (inList) {
                        htmlResult += '</ul>\n';
                        inList = false;
                    }
                    htmlResult += `<p>${trimmedLine}</p>\n`;
                }
            });

            if (inList) {
                htmlResult += '</ul>\n';
            }

            return {
                name: (dir.name || '').trim(),
                content: htmlResult.trim(), // Сохраняем уже готовый, чистый HTML-код
                technologies: (dir.technologies || []).map(tech => {
                    let finalTechImage = (tech.techImage || '').trim();
                    const matchingFile = files.find(f => f.fieldname === tech.fileKey);
                    if (matchingFile) {
                        finalTechImage = '/uploads/' + matchingFile.filename;
                    }
                    return {
                        techName: (tech.techName || '').trim(),
                        techImage: finalTechImage
                    };
                })
            };
        });

        const success = writeDatabase(currentDb);
        if (success) {
            return res.json({ success: true });
        } else {
            return res.status(500).json({ success: false, error: 'Ошибка записи на диск.' });
        }
    } catch (err) {
        console.error('Ошибка парсинга направлений:', err);
        return res.status(400).json({ success: false, error: 'Невалидные данные.' });
    }
});

// Обработка сохранения вакансий
app.post('/admin/save-vacancies', (req, res) => {
    const { vTitle, vAddress, vUrl } = req.body;
    const currentDb = readDatabase();
    
    currentDb.vacancies = [];
    
    const titles = Array.isArray(vTitle) ? vTitle : (vTitle ? [vTitle] : []);
    const addresses = Array.isArray(vAddress) ? vAddress : (vAddress ? [vAddress] : []);
    const urls = Array.isArray(vUrl) ? vUrl : (vUrl ? [vUrl] : []);

    for (let i = 0; i < titles.length; i++) {
        currentDb.vacancies.push({
            title: (titles[i] || '').trim(),
            address: (addresses[i] || '').trim(),
            url: (urls[i] || '').trim()
        });
    }

    const success = writeDatabase(currentDb);
    if (success) {
        res.redirect('/admin');
    } else {
        res.status(500).send('Ошибка при сохранении вакансий.');
    }
});

// Обработка сохранения изменений формы контактов
app.post('/admin/save-contact-form', (req, res) => {
    const { heading, description, submitText } = req.body;
    const currentDb = readDatabase();

    const descRaw = description || '';

    currentDb.contactForm = {
        heading: (heading || '').trim(),
        description: descRaw.trim().replace(/\r?\n/g, '<br>'),
        submitText: (submitText || '').trim()
    };

    const success = writeDatabase(currentDb);
    if (success) {
        res.redirect('/admin');
    } else {
        res.status(500).send('Ошибка при сохранении формы контактов.');
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});