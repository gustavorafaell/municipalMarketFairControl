const router = require('express').Router();
const { body, validationResult } = require('express-validator/check');
const { isCpf } = require('./utils');
const authMiddleware = require('../middlewares/auth');
const participaController = require('../controllers/participa');
const feiraController = require('../controllers/feira');
const feiranteController = require('../controllers/feirante');
const celulaController = require('../controllers/celula');
const models = require('../models/');


router.get('/data/:data', async (req, res) => {
  const { data } = req.params;

  const participaram = await participaController.getFeirantesParticipantes(data);
  const naoParticiparam = await participaController.getFeirantesNaoParticipantes(data);

  if (!participaram && !naoParticiparam) {
    return res.status(400).send({
      msg: 'feira_invalida',
    });
  }

  const faturamento = await participaram.reduce((tot, feirante) => tot + feirante.faturamento, 0);

  if (participaram !== null) {
    return res.status(200).send({
      participaram,
      naoParticiparam,
      faturamento,
    });
  }
  return res.status(400).send({
    msg: 'nenhum_participante',
  });
});

router.get('/faturamento-periodo/:data', async (req, res) => {
  const { data } = req.params;

  const faturamentoPorPeriodo = await participaController.getFaturamentoPorPeriodo(data);

  if (!faturamentoPorPeriodo) {
    return res.status(400).send({
      msg: 'feira_invalida',
    });
  }

  if (faturamentoPorPeriodo !== null) {
    return res.status(200).send({
      faturamentoPorPeriodo,
    });
  }
  return res.status(400).send({
    msg: 'nenhum_participante',
  });
});

router.get('/confirmados', authMiddleware.isSupervisor, async (req, res) => {
  const confirmados = await participaController.listFeirantesConfirmadosFeiraAtual();
  if (confirmados === null) {
    return res.json({ msg: 'feira_invalida' });
  }
  return res.json(confirmados);
});

router.post(
  '/confirma',
  authMiddleware.isFeirante,
  [body('periodo').isInt({ min: 1, max: 3 })],
  async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).send();

    const cpfFeirante = req.cpf;
    const { periodo } = req.body;

    const feira = await feiraController.findFeiraAtual();
    if (feira === null) return res.json({ msg: 'feira_invalida' });

    const dataLimite = feira.data_limite;
    const agora = new Date();

    if (agora > dataLimite) return res.json({ msg: 'confirmacao_fechada' });

    const feirante = await feiranteController.findFeiranteByCpf(cpfFeirante);
    if (feirante === null) return null;

    const celulaFeirante = await celulaController.findCelulaByFeirante(cpfFeirante);
    if (celulaFeirante !== null && celulaFeirante.periodo !== periodo) return res.json({ msg: 'periodo_invalido' });

    const confirmacao = await participaController.isFeiranteConfirmadoFeiraAtual(cpfFeirante);
    if (confirmacao === true) return res.json({ msg: 'ja_confirmado' });

    const ret = await participaController.confirmaPresencaFeiraAtual(cpfFeirante, periodo);
    if (ret === null) return res.json({ msg: 'erro' });

    return res.json({ msg: 'ok' });
  },
);

router.post('/cancela', authMiddleware.isFeirante, async (req, res) => {
  const cpfFeirante = req.cpf;

  const feira = await feiraController.findFeiraAtual();
  if (feira === null) return res.json({ msg: 'feira_invalida' });

  const dataLimite = feira.data_limite;
  const agora = new Date();

  if (agora > dataLimite) return res.json({ msg: 'cancelamento_fechado' });

  const confirmacao = await participaController.isFeiranteConfirmadoFeiraAtual(cpfFeirante);
  if (confirmacao === false) return res.json({ msg: 'nao_confirmado' });

  const ret = await participaController.cancelaPresencaFeiraAtual(cpfFeirante);
  if (ret === null) return res.json({ msg: 'erro' });

  return res.json({ msg: 'ok' });
});

router.post(
  '/posicao',
  authMiddleware.isSupervisor,
  [
    body('cpf_feirante').custom(isCpf),
    body('force').isInt(),
    body('celula_id').isInt(),
  ],
  async (req, res) => {
    // const errors = validationResult(req);
    if (!req.body) return res.status(400).send();

    const {
      force, celula_id: celulaId, cpf_feirante: cpfFeirante,
    } = req.body;


    if (typeof celulaId !== 'number' && celulaId !== null) return res.status(400).send();
    const feira = await feiraController.findFeiraAtual();
    if (feira === null) return res.json({ msg: 'feira_invalida' });

    const confirmacao = await models.participa.findOne({
      where: {
        data_feira: feira.data,
        cpf_feirante: cpfFeirante,
      },
    });

    if (confirmacao === null) return res.json({ msg: 'feirante_invalido' });

    if (celulaId !== null) {
      const celula = await celulaController.findCelulaById(celulaId);
      if (celula === null) return res.json({ msg: 'celula_invalida' });
      // if (celula.periodo !== confirmacao.periodo) return res.json({ msg: 'periodo_invalido' });

      const dadosCelula = await participaController.getDadosCelulaFeiraAtual(celulaId);
      if (dadosCelula.cpfFeirante !== null && force === false) {
        return res.json({ msg: 'celula_ocupada' });
      }
    }

    const ret = await participaController.setPosicaoFeiranteFeiraAtual(
      cpfFeirante,
      celulaId,
      force,
    );

    if (ret === null) return res.json({ msg: 'erro' });

    return res.json({ msg: 'ok' });
  },
);

module.exports = router;
