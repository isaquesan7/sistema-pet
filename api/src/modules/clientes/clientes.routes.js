import { Router } from "express";

import {
  autenticarUsuario,
  selecionarEmpresa,
  exigirPermissao,
} from "../../middlewares/auth.middleware.js";

import {
  criar,
  listar,
  buscarPorId,
  atualizar,
  excluir,
  relacionados,
} from "./clientes.controller.js";

const router = Router();

router.use(
  autenticarUsuario,
  selecionarEmpresa
);

router.get(
  "/",
  exigirPermissao("clientes.visualizar"),
  listar
);

router.get("/:id/relacionados",exigirPermissao("clientes.visualizar"),relacionados);

router.get(
  "/:id",
  exigirPermissao("clientes.visualizar"),
  buscarPorId
);

router.post(
  "/",
  exigirPermissao("clientes.criar"),
  criar
);

router.patch(
  "/:id",
  exigirPermissao("clientes.editar"),
  atualizar
);

router.delete("/:id",exigirPermissao("clientes.editar"),(req,res,next)=>{
  if(!["PROPRIETARIO","ADMINISTRADOR"].includes(req.vinculoOrganizacao?.papel))return res.status(403).json({success:false,message:"Somente proprietário ou administrador pode excluir clientes."});
  next();
},excluir);

export default router;