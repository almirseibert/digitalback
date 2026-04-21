// Importação das dependências necessárias
// Execute no terminal: npm install express cors mysql2 dotenv
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

// Inicialização da aplicação Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globais
app.use(cors()); // Permite requisições do frontend (React)
app.use(express.json()); // Permite que a API receba dados no formato JSON

// ============================================================================
// CONFIGURAÇÃO DA BASE DE DADOS (MySQL)
// ============================================================================
// Na prática, estas credenciais devem vir de um ficheiro .env
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', // Insira a palavra-passe do seu MySQL
    database: 'digital_plus_crm',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ============================================================================
// SERVIÇOS AUXILIARES (Integrações)
// ============================================================================
/**
 * Serviço simulado de envio de mensagens WhatsApp.
 * Numa implementação real, integraria com a API oficial da Meta, Twilio ou whatsapp-web.js
 */
const whatsappService = {
    enviarMensagem: async (telefone, mensagem) => {
        console.log('\n======================================');
        console.log(`[WHATSAPP API] A enviar mensagem para: ${telefone}`);
        console.log(`[CONTEÚDO] ${mensagem}`);
        console.log('======================================\n');
        // Simula um atraso de rede de 1 segundo
        return new Promise(resolve => setTimeout(() => resolve(true), 1000));
    }
};

// ============================================================================
// ROTAS E CONTROLADORES (CRM & Vendas)
// ============================================================================

// 1. Rota de teste para verificar se a API está online
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', mensagem: 'API digit@l plus+ a funcionar corretamente!' });
});

// 2. Listar todos os leads/negociações do Kanban
app.get('/api/negociacoes', async (req, res) => {
    try {
        // Faz o JOIN entre clientes e negociacoes para devolver os dados completos ao Frontend
        const query = `
            SELECT n.id, c.nome AS cliente, c.empresa, c.telefone, n.valor_estimado AS valor, n.fase_funil AS fase
            FROM negociacoes n
            JOIN clientes c ON n.cliente_id = c.id
            ORDER BY n.data_criacao DESC
        `;
        const [rows] = await dbPool.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Erro ao procurar negociações:', error);
        res.status(500).json({ success: false, error: 'Erro interno no servidor.' });
    }
});

// 3. Atualizar a fase de um lead (Drag & Drop) e disparar Automação WhatsApp
app.put('/api/negociacoes/:id/fase', async (req, res) => {
    const { id } = req.params;
    const { novaFase } = req.body;

    if (!novaFase) {
        return res.status(400).json({ success: false, error: 'A nova fase é obrigatória.' });
    }

    try {
        // 3.1. Atualizar a fase na base de dados
        await dbPool.query('UPDATE negociacoes SET fase_funil = ? WHERE id = ?', [novaFase, id]);

        // 3.2. Procurar os dados do cliente para personalizar a mensagem
        const queryCliente = `
            SELECT c.telefone, c.nome, c.empresa 
            FROM clientes c 
            JOIN negociacoes n ON c.id = n.cliente_id 
            WHERE n.id = ?
        `;
        const [rows] = await dbPool.query(queryCliente, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Negociação não encontrada.' });
        }

        const cliente = rows[0];
        let mensagemPreProgramada = "";

        // 3.3. Lógica de Regras de Negócio (Mensagens baseadas na fase)
        switch(novaFase) {
            case 'Qualificação':
                mensagemPreProgramada = `Olá ${cliente.nome}! Aqui é da digit@l plus+. Recebemos o interesse da ${cliente.empresa}. Qual seria o melhor horário para agendarmos uma breve chamada de alinhamento? 🚀`;
                break;
            case 'Proposta':
                mensagemPreProgramada = `Oi ${cliente.nome}! Acabei de enviar a nossa proposta comercial para o seu e-mail. Analise com calma e avise-me por aqui para esclarecermos qualquer dúvida. ✨`;
                break;
            case 'Ganho':
                mensagemPreProgramada = `Parabéns, ${cliente.nome}! 🎉 Bem-vindo(a) à digit@l plus+. A nossa equipa já vai dar início ao planeamento do seu projeto. Vamos revolucionar a ${cliente.empresa}!`;
                break;
        }

        // 3.4. Se existir uma mensagem para esta fase, envia via WhatsApp e regista o histórico
        if (mensagemPreProgramada !== "") {
            // Dispara o WhatsApp
            await whatsappService.enviarMensagem(cliente.telefone, mensagemPreProgramada);
            
            // Regista a interação na base de dados
            await dbPool.query(`
                INSERT INTO interacoes (negociacao_id, tipo, descricao, mensagem_automatica) 
                VALUES (?, 'WhatsApp', ?, true)
            `, [id, mensagemPreProgramada]);
        }

        res.json({ 
            success: true, 
            mensagem: 'Fase atualizada com sucesso!', 
            automacao_disparada: mensagemPreProgramada !== "" 
        });

    } catch (error) {
        console.error('Erro ao atualizar fase:', error);
        res.status(500).json({ success: false, error: 'Erro ao processar a atualização da fase.' });
    }
});

// 4. Criar um novo Lead/Negociação
app.post('/api/negociacoes', async (req, res) => {
    const { nome, empresa, telefone, email, valor_estimado, titulo } = req.body;

    try {
        // Esta operação deve ser feita numa transação (garantir que cria o cliente e a negociação juntos)
        const connection = await dbPool.getConnection();
        await connection.beginTransaction();

        try {
            // 4.1 Cria o Cliente
            const [clienteResult] = await connection.query(
                'INSERT INTO clientes (nome, empresa, telefone, email, origem) VALUES (?, ?, ?, ?, ?)',
                [nome, empresa, telefone, email, 'Inserção Manual CRM']
            );
            
            const clienteId = clienteResult.insertId;

            // 4.2 Cria a Negociação associada ao cliente na fase inicial
            await connection.query(
                'INSERT INTO negociacoes (cliente_id, titulo, valor_estimado, fase_funil) VALUES (?, ?, ?, ?)',
                [clienteId, titulo || `Projeto ${empresa}`, valor_estimado || 0, 'Prospecção']
            );

            await connection.commit();
            res.status(201).json({ success: true, mensagem: 'Lead criado com sucesso!' });

        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Erro ao criar lead:', error);
        res.status(500).json({ success: false, error: 'Erro ao criar o novo contacto.' });
    }
});

// ============================================================================
// ARRANQUE DO SERVIDOR
// ============================================================================
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor Backend CRM digit@l plus+ a correr na porta ${PORT}`);
    console.log(`Aguardando conexões do Frontend...`);
});