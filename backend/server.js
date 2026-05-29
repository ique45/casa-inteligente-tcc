require('dotenv').config();

if (!process.env.ARDUINO_SECRET) {
  console.error('FATAL: variável ARDUINO_SECRET não configurada');
  process.exit(1);
}

const express      = require('express');
const cors         = require('cors');
const arduinoRoute = require('./routes/arduino');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/arduino', arduinoRoute);

app.get('/', (_req, res) => res.json({ app: 'Casa Inteligente Backend', status: 'online' }));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
