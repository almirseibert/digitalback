const mysql = require('mysql2/promise');
require('dotenv').config();

const dbPool = mysql.createPool({
    host: process.env.DB_HOST || '217.196.60.62',
    port: process.env.DB_PORT || 3301,
    user: process.env.DB_USER || 'mysql',
    password: process.env.DB_PASSWORD || 'Miguel@18032018',
    database: process.env.DB_DATABASE || 'digitalplussmysql',
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
