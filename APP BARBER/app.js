const express = require('express');
const mysql = require('mysql2/promise'); // Usando versão assíncrona do mysql2
const bcrypt = require('bcryptjs');
const cors = require('cors');
const moment = require('moment');

const app = express();
const PORT = 3000;

// Configuração do banco de dados
const dbConfig = {
    host: '127.0.0.1',  // Ou IP da VPS se a aplicação estiver externa
    user: 'guilhermembo',  // Usuário do banco de dados
    password: '@Nogui086A!', // Senha do banco de dados
    database: 'barbearia', // Nome do banco
    port: 3306 // Porta padrão do MySQL/MariaDB
};

// Middleware
app.use(cors());
app.use(express.json()); // Para permitir JSON no corpo das requisições

// Teste de conexão com o banco de dados
async function connectDB() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado ao banco de dados MySQL!');
        await connection.end();
    } catch (err) {
        console.error('❌ Erro ao conectar no MySQL:', err);
    }
}
connectDB();

// Rota principal
app.get('/', (req, res) => {
    res.send('🚀 Servidor funcionando!');
});

// Endpoint para cadastro de barbearia
app.post('/register', async (req, res) => {
    const { nome, email, senha, telefone, endereco } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Verificar se o email já existe
        const [existingUser] = await connection.execute('SELECT id FROM barbearias WHERE email = ?', [email]);

        if (existingUser.length > 0) {
            await connection.end();
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        // Gerar hash da senha
        const hashedPassword = await bcrypt.hash(senha, 10);

        // Criar data de criação e expiração do plano gratuito (3 dias)
        const dataCriacao = moment().format('YYYY-MM-DD HH:mm:ss');
        const planoExpira = moment().add(3, 'days').format('YYYY-MM-DD HH:mm:ss');

        // Inserir nova barbearia no banco
        const query = `
            INSERT INTO barbearias 
            (nome, email, senha, telefone, endereco, plano, data_criacao, plano_expira) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.execute(query, [nome, email, hashedPassword, telefone, endereco, 'básico', dataCriacao, planoExpira]);

        await connection.end();

        res.status(201).json({ message: '🎉 Barbearia cadastrada com sucesso!', plano_expira: planoExpira });
    } catch (err) {
        console.error('❌ Erro ao cadastrar a barbearia:', err);
        res.status(500).json({ error: 'Erro ao cadastrar a barbearia' });
    }
});

// Endpoint para login
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Buscar barbearia pelo email
        const [rows] = await connection.execute('SELECT * FROM barbearias WHERE email = ?', [email]);

        if (rows.length === 0) {
            await connection.end();
            return res.status(400).json({ error: 'Email ou senha incorretos' });
        }

        const barbearia = rows[0];

        // Verificar senha
        const isMatch = await bcrypt.compare(senha, barbearia.senha);
        if (!isMatch) {
            await connection.end();
            return res.status(400).json({ error: 'Email ou senha incorretos' });
        }

        // Verificar se o plano gratuito expirou
        const agora = moment();
        const dataExpiracaoPlano = moment(barbearia.plano_expira);

        let plano = barbearia.plano;
        if (agora.isAfter(dataExpiracaoPlano)) {
            // Plano expirado, rebaixar para 'básico'
            await connection.execute('UPDATE barbearias SET plano = ?, plano_expira = NULL WHERE id = ?', ['básico', barbearia.id]);
            plano = 'básico';
        }

        await connection.end();

        res.json({
            message: '✅ Login bem-sucedido',
            plano,
            agendamentos: [] // Substituir isso pelo real histórico de agendamentos, se necessário
        });
    } catch (err) {
        console.error('❌ Erro ao processar login:', err);
        res.status(500).json({ error: 'Erro ao processar login' });
    }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
});
