const dbPool = require('../config/db');

const whatsappService = {
    enviarMensagem: async (telefone, mensagem) => {
        console.log(`\n📱 [WHATSAPP] Para: ${telefone} | Msg: ${mensagem}\n`);
        return new Promise(resolve => setTimeout(() => resolve(true), 1000));
    }
};

const negociacaoController = {
    listarNegociacoes: async (req, res) => {
        try {
            const query = `
                SELECT n.id, c.nome AS cliente, c.empresa, c.telefone, n.valor_estimado AS valor, n.fase_funil AS fase
                FROM negociacoes n
                JOIN clientes c ON n.cliente_id = c.id
                ORDER BY n.data_criacao DESC
            `;
            const [rows] = await dbPool.query(query);
            res.json({ success: true, data: rows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: 'Erro interno no servidor.' });
        }
    },

    atualizarFase: async (req, res) => {
        const { id } = req.params;
        const { novaFase } = req.body;

        try {
            await dbPool.query('UPDATE negociacoes SET fase_funil = ? WHERE id = ?', [novaFase, id]);

            const [rows] = await dbPool.query(`SELECT c.telefone, c.nome, c.empresa FROM clientes c JOIN negociacoes n ON c.id = n.cliente_id WHERE n.id = ?`, [id]);
            if (rows.length === 0) return res.status(404).json({ success: false, error: 'Negociação não encontrada.' });

            const cliente = rows[0];
            let msg = "";

            switch(novaFase) {
                case 'Qualificação': msg = `Olá ${cliente.nome}! Recebemos o interesse da ${cliente.empresa}. Qual seria o melhor horário para uma chamada? 🚀`; break;
                case 'Proposta': msg = `Oi ${cliente.nome}! Enviei a proposta para o seu e-mail. Analise e avise-me. ✨`; break;
                case 'Ganho': msg = `Parabéns, ${cliente.nome}! 🎉 Bem-vindo(a) à digit@l plus+.`; break;
            }

            if (msg !== "") {
                await whatsappService.enviarMensagem(cliente.telefone, msg);
                await dbPool.query(`INSERT INTO interacoes (negociacao_id, tipo, descricao, mensagem_automatica) VALUES (?, 'WhatsApp', ?, true)`, [id, msg]);
            }

            res.json({ success: true, automacao_disparada: msg !== "" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: 'Erro ao processar.' });
        }
    },

    criarNegociacao: async (req, res) => {
        const { nome, empresa, telefone, email, valor_estimado, titulo } = req.body;
        const connection = await dbPool.getConnection();
        
        try {
            await connection.beginTransaction();
            const [clienteResult] = await connection.query('INSERT INTO clientes (nome, empresa, telefone, email, origem) VALUES (?, ?, ?, ?, ?)', [nome, empresa, telefone, email, 'Manual']);
            await connection.query('INSERT INTO negociacoes (cliente_id, titulo, valor_estimado, fase_funil) VALUES (?, ?, ?, ?)', [clienteResult.insertId, titulo || `Projeto ${empresa}`, valor_estimado || 0, 'Prospecção']);
            await connection.commit();
            res.status(201).json({ success: true });
        } catch (error) {
            await connection.rollback();
            console.error(error);
            res.status(500).json({ success: false, error: 'Erro ao criar o novo contato.' });
        } finally {
            connection.release();
        }
    }
};

module.exports = negociacaoController;