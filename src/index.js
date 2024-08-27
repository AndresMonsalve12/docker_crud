import express from 'express';
import { createPool } from 'mysql2/promise';

const app = express();
app.use(express.json());

// Configuración de la base de datos
const pool = createPool({
    host: 'mysqldb', // Nombre del servicio en docker-compose.yml
    user: 'root',
    password: '1234',
    database: 'personas',
    port: 3306 // Puerto dentro del contenedor
});

// Iniciar el servidor
app.listen(3000, async () => {
    console.log('Server is running on port 3000');

    // Esperar hasta que la base de datos esté lista
    await waitForDatabase();

    // Inicializar la base de datos
    await initializeDatabase();
});

// Función para esperar a que la base de datos esté disponible
async function waitForDatabase() {
    let connected = false;
    while (!connected) {
        try {
            await pool.getConnection();
            connected = true;
            console.log('Database is ready.');
        } catch (err) {
            console.log('Waiting for database...');
            await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos antes de intentar de nuevo
        }
    }
}

// Función para inicializar la base de datos y crear tablas
async function initializeDatabase() {
    const connection = await pool.getConnection();
    try {
        await connection.query('USE personas');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE
            )
        `);
        console.log('Database and table initialized.');
    } catch (error) {
        console.error('Error initializing database:', error.message);
    } finally {
        connection.release();
    }
}

// Endpoint principal
app.get("/", (req, res) => {
    res.send("hello world");
});

// Endpoint de prueba de conexión
app.get("/ping", async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT NOW()');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error connecting to the database' });
    }
});

// CRUD endpoints

// Crear un usuario
app.post("/users", async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }
    try {
        const [result] = await pool.query('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
        res.status(201).json({ id: result.insertId, name, email });
    } catch (error) {
        res.status(500).json({ error: 'Error creating user' });
    }
});

// Obtener todos los usuarios
app.get("/users", async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// Obtener un usuario por ID
app.get("/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user' });
    }
});

// Actualizar un usuario
app.put("/users/:id", async (req, res) => {
    const { id } = req.params;
    const { name, email } = req.body;
    if (!name && !email) {
        return res.status(400).json({ error: 'Name or email is required' });
    }
    try {
        const [result] = await pool.query('UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?', [name, email, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ id, name, email });
    } catch (error) {
        res.status(500).json({ error: 'Error updating user' });
    }
});

// Eliminar un usuario
app.delete("/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting user' });
    }
});
