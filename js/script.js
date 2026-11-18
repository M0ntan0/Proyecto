/* Sirve para las claves */
const LS_CUENTAS     = "elysium_cuentas";
const SS_SESION      = "elysium_sesion";
const LS_PERFIL      = "elysium_perfil_";        
const LS_POSTS       = "elysium_posts_usuario";
const LS_LIKES       = "elysium_likes_";         
const LS_COMENTARIOS = "elysium_comentarios";

/*Funciones */
const $ = (id) => document.getElementById(id);

function leer(clave, porDefecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto ? JSON.parse(texto) : porDefecto;
  } catch (e) {
    return porDefecto;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (e) {
    return false;
  }
}

function leerSesion() {
  try {
    return JSON.parse(sessionStorage.getItem(SS_SESION) || "null");
  } catch (e) {
    return null;
  }
}

function mensaje(id, texto, ok) {
  const el = $(id);
  if (!el) return;
  el.textContent = texto;
  el.classList.toggle("ok", !!ok);
}

function iniciales(nombre) {
  const partes = (nombre || "?").trim().split(/\s+/).slice(0, 2);
  return partes.map((p) => p.charAt(0).toUpperCase()).join("");
}

function ponerAvatar(el, nombre, foto) {
  el.style.backgroundImage = foto ? "url(" + JSON.stringify(foto) + ")" : "";
  el.textContent = foto ? "" : iniciales(nombre);
}

function obtenerPerfil(correo) {
  return leer(LS_PERFIL + correo, {});
}

/* vistas */
function mostrarAuth() {
  $("app-view").hidden = true;
  $("auth-view").hidden = false;
  mostrarFormulario("login");
}

function mostrarApp() {
  $("auth-view").hidden = true;
  $("app-view").hidden = false;
  actualizarPerfil();
  cargarPublicaciones();
}

function mostrarFormulario(cual) {
  $("login-form").hidden = cual !== "login";
  $("register-form").hidden = cual !== "register";
  mensaje("login-message", "");
  mensaje("register-message", "");
}

/* Sirve para el inicio de sesión, registro y cerrar sesión*/
$("go-register").addEventListener("click", () => mostrarFormulario("register"));
$("go-login").addEventListener("click", () => mostrarFormulario("login"));
["go-register", "go-login"].forEach((id) => {
  $(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $(id).click(); }
  });
});

$("register-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const nombre = $("register-name").value.trim();
  const correo = $("register-email").value.trim().toLowerCase();
  const clave = $("register-password").value;
  const confirmacion = $("confirm-password").value;

  if (!nombre || !correo || !clave || !confirmacion) {
    return mensaje("register-message", "Completa todos los campos.");
  }
  if (clave.length < 8) {
    return mensaje("register-message", "La contraseña debe tener al menos 8 caracteres.");
  }
  if (clave !== confirmacion) {
    return mensaje("register-message", "Las contraseñas no coinciden.");
  }

  const cuentas = leer(LS_CUENTAS, {});
  if (cuentas[correo]) {
    return mensaje("register-message", "Ya existe una cuenta con ese correo.");
  }

  cuentas[correo] = { nombre: nombre, clave: clave };
  if (!guardar(LS_CUENTAS, cuentas)) {
    return mensaje("register-message", "No se pudo guardar la cuenta en este navegador.");
  }

  sessionStorage.setItem(SS_SESION, JSON.stringify({ nombre: nombre, correo: correo }));
  event.target.reset();
  mostrarApp();
  window.scrollTo(0, 0);
});

$("login-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const correo = $("login-email").value.trim().toLowerCase();
  const clave = $("login-password").value;
  const cuentas = leer(LS_CUENTAS, {});

  if (Object.keys(cuentas).length === 0) {
    return mensaje("login-message", "Todavía no hay cuentas. Selecciona Crear cuenta.");
  }

  const cuenta = cuentas[correo];
  if (!cuenta || cuenta.clave !== clave) {
    return mensaje("login-message", "El correo o la contraseña no son correctos.");
  }

  sessionStorage.setItem(SS_SESION, JSON.stringify({ nombre: cuenta.nombre, correo: correo }));
  event.target.reset();
  mostrarApp();
  window.scrollTo(0, 0);
});

$("logout-button").addEventListener("click", () => {
  sessionStorage.removeItem(SS_SESION);
  mostrarAuth();
});

/*Foto de perfil y banner*/
function actualizarPerfil() {
  const sesion = leerSesion();
  if (!sesion) return;
  const perfil = obtenerPerfil(sesion.correo);

  $("user-label").textContent = sesion.nombre;
  $("profile-name").textContent = sesion.nombre;
  $("profile-email").textContent = sesion.correo;

  ponerAvatar($("header-avatar"), sesion.nombre, perfil.avatar);
  ponerAvatar($("profile-avatar"), sesion.nombre, perfil.avatar);

  $("profile-banner").style.backgroundImage = perfil.banner
    ? "url(" + JSON.stringify(perfil.banner) + ")"
    : "";

  const propias = leer(LS_POSTS, []).filter((p) => p.autorCorreo === sesion.correo).length;
  $("profile-stats").textContent =
    propias + (propias === 1 ? " publicación creada" : " publicaciones creadas");
}

/*Imagenes*/
function procesarImagen(archivo, ancho, alto) {
  return new Promise((resolver, rechazar) => {
    if (!archivo || !archivo.type.startsWith("image/")) {
      return rechazar(new Error("no-imagen"));
    }
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error("lectura"));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => rechazar(new Error("imagen"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext("2d");
        const escala = Math.max(ancho / img.width, alto / img.height);
        const w = img.width * escala;
        const h = img.height * escala;
        ctx.drawImage(img, (ancho - w) / 2, (alto - h) / 2, w, h);
        resolver(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

async function cambiarImagen(input, campo, ancho, alto, textoOk) {
  const sesion = leerSesion();
  const archivo = input.files && input.files[0];
  input.value = "";
  if (!sesion || !archivo) return;

  try {
    const datos = await procesarImagen(archivo, ancho, alto);
    const perfil = obtenerPerfil(sesion.correo);
    perfil[campo] = datos;
    if (!guardar(LS_PERFIL + sesion.correo, perfil)) {
      return mensaje("profile-message", "La imagen es muy pesada para guardarla. Prueba con otra.");
    }
    actualizarPerfil();
    refrescarAvatares();
    mensaje("profile-message", textoOk, true);
  } catch (e) {
    mensaje("profile-message", "No se pudo usar ese archivo. Elige una imagen (JPG, PNG o WebP).");
  }
}

$("btn-avatar").addEventListener("click", () => $("file-avatar").click());
$("btn-banner").addEventListener("click", () => $("file-banner").click());
$("file-avatar").addEventListener("change", (e) =>
  cambiarImagen(e.target, "avatar", 400, 400, "Foto de perfil actualizada."));
$("file-banner").addEventListener("change", (e) =>
  cambiarImagen(e.target, "banner", 1200, 400, "Banner actualizado."));

$("btn-reset-images").addEventListener("click", () => {
  const sesion = leerSesion();
  if (!sesion) return;
  localStorage.removeItem(LS_PERFIL + sesion.correo);
  actualizarPerfil();
  refrescarAvatares();
  mensaje("profile-message", "Se quitaron la foto y el banner.", true);
});

/* Publicaicones */
function tarjetas() {
  return document.querySelectorAll("#post-grid .post-card");
}

/*nombre de las publicaciones */
function nombreDeAvatar(avatar) {
  const caja = avatar.closest(".comment, .post-author");
  const nombre = caja && caja.querySelector(".comment-name, .author-name");
  return nombre ? nombre.textContent.trim() : "?";
}

/*Foto de los usuarios */
function refrescarAvatares() {
  document.querySelectorAll("#post-grid .avatar").forEach((av) => {
    const nombre = nombreDeAvatar(av);
    if (av.dataset.correo) {
      ponerAvatar(av, nombre, obtenerPerfil(av.dataset.correo).avatar);
    } else {
      ponerAvatar(av, nombre, av.dataset.foto || "");
    }
  });
}

function misLikes() {
  const sesion = leerSesion();
  return sesion ? leer(LS_LIKES + sesion.correo, []) : [];
}

function repintarLikes() {
  const lista = misLikes();
  tarjetas().forEach((card) => {
    const boton = card.querySelector(".like-btn");
    const base = parseInt(boton.dataset.likes || "0", 10) || 0;
    const activo = lista.includes(card.dataset.id);
    boton.textContent = (activo ? "♥ " : "♡ ") + (base + (activo ? 1 : 0));
    boton.classList.toggle("liked", activo);
    boton.setAttribute("aria-pressed", String(activo));
  });
}

function alternarLike(card) {
  const sesion = leerSesion();
  if (!sesion) return;
  const lista = misLikes();
  const i = lista.indexOf(card.dataset.id);
  if (i === -1) lista.push(card.dataset.id); else lista.splice(i, 1);
  guardar(LS_LIKES + sesion.correo, lista);
  repintarLikes();
}

function actualizarContadores() {
  tarjetas().forEach((card) => {
    const total = card.querySelectorAll(".comment").length;
    card.querySelector(".comment-btn").textContent = "💬 " + total;
  });
}

function crearComentario(c) {
  const nodo = $("plantilla-comentario").content.firstElementChild.cloneNode(true);
  nodo.querySelector(".comment-name").textContent = c.nombre;
  nodo.querySelector(".comment-text").textContent = c.texto;
  nodo.querySelector(".avatar").dataset.correo = c.correo;
  return nodo;
}

function agregarComentario(card, campo) {
  const sesion = leerSesion();
  const texto = campo.value.trim();
  if (!sesion || !texto) return;

  const guardados = leer(LS_COMENTARIOS, {});
  const id = card.dataset.id;
  const nuevo = { nombre: sesion.nombre, correo: sesion.correo, texto: texto };
  guardados[id] = guardados[id] || [];
  guardados[id].push(nuevo);
  guardar(LS_COMENTARIOS, guardados);

  card.querySelector(".comment-list").append(crearComentario(nuevo));
  campo.value = "";
  refrescarAvatares();
  actualizarContadores();
}

/*Botones */
function prepararTarjeta(card) {
  if (card.dataset.listo) return;
  card.dataset.listo = "1";

  card.querySelector(".like-btn").addEventListener("click", () => alternarLike(card));

  const caja = card.querySelector(".comments");
  card.querySelector(".comment-btn").addEventListener("click", () => {
    caja.hidden = !caja.hidden;
  });

  const form = card.querySelector(".comment-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    agregarComentario(card, form.querySelector("input"));
  });
}

/* Crear publicacion */
function crearPublicacionUsuario(p) {
  const card = $("plantilla-publicacion").content.firstElementChild.cloneNode(true);
  card.dataset.id = p.id;
  card.querySelector(".post-category").textContent = p.categoria;
  card.querySelector("h3").textContent = p.titulo;
  card.querySelector(".post-text").textContent = p.texto;
  card.querySelector(".author-name").textContent = p.autorNombre;
  card.querySelector(".avatar").dataset.correo = p.autorCorreo;
  return card;
}
function cargarPublicaciones() {
  const grid = $("post-grid");

  /* Quita lo que se creó para una sesión anterior */
  grid.querySelectorAll(".post-card.de-usuario, .comment.de-usuario").forEach((n) => n.remove());

  /*Hace que la publicacion que sea reciente aparezca arriba de las demás*/
  leer(LS_POSTS, []).slice().reverse().forEach((p) => {
    grid.prepend(crearPublicacionUsuario(p));
  });

  tarjetas().forEach(prepararTarjeta);

  /* Guarda los comentarios mientras se use el sitio */
  const guardados = leer(LS_COMENTARIOS, {});
  tarjetas().forEach((card) => {
    (guardados[card.dataset.id] || []).forEach((c) => {
      card.querySelector(".comment-list").append(crearComentario(c));
    });
  });

  refrescarAvatares();
  repintarLikes();
  actualizarContadores();
  filtrarPublicaciones();
}

/* Crear publicación */
$("post-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const sesion = leerSesion();
  const titulo = $("post-title").value.trim();
  const categoria = $("post-category").value;
  const texto = $("post-content").value.trim();

  if (!sesion || !titulo || !texto) {
    return mensaje("post-message", "Completa el título y el contenido.");
  }

  const nueva = {
    id: "u" + Date.now(),
    categoria: categoria,
    titulo: titulo,
    texto: texto,
    autorNombre: sesion.nombre,
    autorCorreo: sesion.correo
  };

  const lista = leer(LS_POSTS, []);
  lista.unshift(nueva);
  guardar(LS_POSTS, lista);

  const card = crearPublicacionUsuario(nueva);
  $("post-grid").prepend(card);
  prepararTarjeta(card);

  event.target.reset();
  $("search-posts").value = "";
  refrescarAvatares();
  repintarLikes();
  actualizarContadores();
  filtrarPublicaciones();
  actualizarPerfil();
  mensaje("post-message", "Publicación agregada a la página.", true);
});

/* Buscar publicaciones */
function filtrarPublicaciones() {
  const consulta = $("search-posts").value.trim().toLowerCase();
  let visibles = 0;

  tarjetas().forEach((card) => {
    const texto = [".post-category", "h3", ".post-text", ".author-name"]
      .map((s) => card.querySelector(s).textContent)
      .join(" ")
      .toLowerCase();
    card.hidden = consulta !== "" && !texto.includes(consulta);
    if (!card.hidden) visibles++;
  });

  $("empty-search").hidden = visibles !== 0;
}

$("search-posts").addEventListener("input", filtrarPublicaciones);

/*Secciones*/
const enlaces = document.querySelectorAll(".sidebar .nav-link");
const secciones = Array.from(enlaces).map((a) => document.querySelector(a.getAttribute("href")));

if ("IntersectionObserver" in window) {
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      enlaces.forEach((a) =>
        a.classList.toggle("active", a.getAttribute("href") === "#" + entrada.target.id));
    });
  }, { rootMargin: "-30% 0px -60% 0px" });
  secciones.forEach((s) => s && observador.observe(s));
}

/*Inicio*/
(function iniciar() {
  const sesion = leerSesion();
  const cuentas = leer(LS_CUENTAS, {});
  if (sesion && cuentas[sesion.correo]) mostrarApp();
  else {
    sessionStorage.removeItem(SS_SESION);
    mostrarAuth();
  }
})();