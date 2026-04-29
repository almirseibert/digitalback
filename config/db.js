const mysql = require('mysql2/promise');
require('dotenv').config();

const dbPool = mysql.createPool({
    host: process.env.DB_HOST || 'sites_digitalplussmysql',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'mysql',
    password: process.env.DB_PASSWORD || 'Miguel@18032018',
    database: process.env.DB_NAME || 'digitalplussmysql',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

dbPool.getConnection()
    .then(conn => {
        console.log('✅ Conexão com o MySQL estabelecida com sucesso!');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Erro ao conectar no MySQL:', err.message);
    });

module.exports = dbPool;
