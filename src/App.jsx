import { useState, useEffect } from 'react'
import { supabase } from './supabase'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState('')
  
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  
  const [vistaActual, setVistaActual] = useState('tareas') 
  const [menuAbierto, setMenuAbierto] = useState(false)
  
  const [subVistaTarea, setSubVistaTarea] = useState('asignar') 
  const [subVistaUsuario, setSubVistaUsuario] = useState('lista') 

  const [formUser, setFormUser] = useState({
    usuario: '', nombre: '', email: '', celular: '', area: 'mecanica', rol: 'miembro'
  })
  const [mensajeRegistro, setMensajeRegistro] = useState('')

  const [passwordActual, setPasswordActual] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [mensajePassword, setMensajePassword] = useState('')

  const [tareas, setTareas] = useState([])
  const [usuariosEquipo, setUsuariosEquipo] = useState([])
  
  const [filtroVista, setFiltroVista] = useState('todas')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [formTarea, setFormTarea] = useState({ id: null, titulo: '', descripcion: '', fecha_limite: '', asignado_a: '', estado: 'Asignada' })

  const COLOR_AZUL_TECNM = '#1B396A'
  const COLOR_VERDE_MOVITEC = '#006847'

  const columnasKanban = [
    { titulo: '📋 Asignadas', estado: 'Asignada', fondo: '#f3f4f6', borde: 'gray' },
    { titulo: '⚙️ En Proceso', estado: 'En Proceso', fondo: '#e0e7ff', borde: '#3b82f6' },
    { titulo: '🔍 Terminadas (Revisión)', estado: 'Terminada', fondo: '#fef3c7', borde: 'orange' },
    { titulo: '🏆 Completadas', estado: 'Completada', fondo: '#ccfbf1', borde: COLOR_VERDE_MOVITEC }
  ]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        obtenerPerfil(session.user.id)
        cargarTablero()
      }
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        obtenerPerfil(session.user.id)
        cargarTablero()
      }
    })
  }, [])

  useEffect(() => {
    if (!session) return;
    let timeoutId;
    const tiempoLimite = 30 * 60 * 1000; // 30 minutos

    const reiniciarTemporizador = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        alert("La sesión ha caducado por inactividad.");
        await supabase.auth.signOut();
        setPerfil(null);
      }, tiempoLimite);
    };

    const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    eventos.forEach(evento => window.addEventListener(evento, reiniciarTemporizador));
    reiniciarTemporizador();

    return () => {
      clearTimeout(timeoutId);
      eventos.forEach(evento => window.removeEventListener(evento, reiniciarTemporizador));
    };
  }, [session]);

  useEffect(() => {
    const handleClickFuera = (e) => {
      if (menuAbierto && !e.target.closest('.menu-usuario-container')) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, [menuAbierto]);

  useEffect(() => {
    if (perfil) {
      if (perfil.rol === 'miembro') setFiltroVista('mis_tareas')
      else setFiltroVista('todas')
    }
  }, [perfil])

  const obtenerPerfil = async (userId) => {
    if (!userId) return
    const { data, error } = await supabase.from('usuarios').select('*').eq('id', userId)
    if (error) {
      await supabase.auth.signOut()
      return
    }
    if (data && data.length > 0) setPerfil(data[0])
    else await supabase.auth.signOut()
  }

  const cargarTablero = async () => {
    const { data: miembros } = await supabase.from('usuarios').select('id, usuario, nombre, area, rol, celular, email')
    if (miembros) setUsuariosEquipo(miembros)

    const { data: listaTareas } = await supabase.from('tareas').select('*').order('fecha_limite', { ascending: true })
    
    if (listaTareas && miembros) {
      const tareasConArea = listaTareas.map(t => {
        const asignado = miembros.find(m => m.id === t.asignado_a)
        return { ...t, area_asignado: asignado ? asignado.area : 'ninguna' }
      })
      setTareas(tareasConArea)
    }
  }

  const iniciarSesion = async (e) => {
    e.preventDefault()
    setMensaje('Comprobando datos...')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMensaje('Error de acceso: Verifica tus datos.')
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    setPerfil(null)
  }

  const registrarUsuario = async (e) => {
    e.preventDefault()
    setMensajeRegistro('Enlazando perfil en la base de datos...')
    const { error } = await supabase.rpc('crear_perfil_admin', {
      p_email: formUser.email, p_usuario: formUser.usuario, p_nombre: formUser.nombre, p_celular: formUser.celular, p_area: formUser.area, p_rol: formUser.rol
    })
    if (error) setMensajeRegistro('Error: ' + error.message)
    else {
      setMensajeRegistro('¡Perfil guardado exitosamente!')
      setFormUser({ usuario: '', nombre: '', email: '', celular: '', area: 'mecanica', rol: 'miembro' })
      cargarTablero()
    }
  }

  const actualizarPassword = async (e) => {
    e.preventDefault()
    setMensajePassword('Verificando...')
    const { error: errorValidacion } = await supabase.auth.signInWithPassword({ email: session.user.email, password: passwordActual })
    if (errorValidacion) return setMensajePassword('Error: Contraseña actual incorrecta.')
    
    const { error: errorActualizacion } = await supabase.auth.updateUser({ password: nuevaPassword })
    if (errorActualizacion) setMensajePassword('Error: ' + errorActualizacion.message)
    else {
      setMensajePassword('¡Contraseña actualizada exitosamente!')
      setPasswordActual(''); setNuevaPassword('') 
    }
  }

  const cambiarSubVistaTarea = (vista) => {
    setSubVistaTarea(vista)
    setModoEdicion(false)
    if (vista === 'asignar') {
      setFormTarea({ id: null, titulo: '', descripcion: '', fecha_limite: '', asignado_a: '', estado: 'Asignada' })
    }
  }

  const guardarTarea = async (e) => {
    e.preventDefault()
    let errorSupabase = null;

    if (modoEdicion) {
      const { error } = await supabase.from('tareas').update({
        titulo: formTarea.titulo, descripcion: formTarea.descripcion, fecha_limite: formTarea.fecha_limite, asignado_a: formTarea.asignado_a, estado: formTarea.estado
      }).eq('id', formTarea.id)
      errorSupabase = error;
      if (!error) setModoEdicion(false);
    } else {
      const { error } = await supabase.from('tareas').insert([{
        titulo: formTarea.titulo, descripcion: formTarea.descripcion, fecha_limite: formTarea.fecha_limite, asignado_a: formTarea.asignado_a, creador_id: session.user.id, estado: 'Asignada'
      }])
      errorSupabase = error;
      if (!error) setFormTarea({ id: null, titulo: '', descripcion: '', fecha_limite: '', asignado_a: '', estado: 'Asignada' })
    }

    if (errorSupabase) alert('Error al guardar: ' + errorSupabase.message)
    else {
      cargarTablero()
      alert(modoEdicion ? 'Tarea actualizada' : 'Tarea asignada correctamente')
    }
  }

  const eliminarTarea = async (id) => {
    if (window.confirm('¿Estás seguro de borrar esta tarea de Movitec?')) {
      await supabase.from('tareas').delete().eq('id', id)
      cargarTablero()
    }
  }

  const cambiarEstadoTarea = async (id, nuevoEstado) => {
    const { error } = await supabase.from('tareas').update({ estado: nuevoEstado }).eq('id', id)
    if (error) alert('Error al actualizar estado: ' + error.message)
    else cargarTablero()
  }

  const obtenerNombreAsignado = (id) => {
    const usuario = usuariosEquipo.find(u => u.id === id)
    return usuario ? usuario.usuario : 'Sin asignar'
  }

  const formatearAreaVisual = (area) => {
    switch(area) {
      case 'mecanica': return 'Mecánica';
      case 'electronica': return 'Electrónica';
      case 'administracion': return 'Administración';
      case 'diseno': return 'Diseño';
      default: return area;
    }
  }

  if (session) {
    if (!perfil) return <p style={{ padding: '20px' }}>Cargando sistema...</p>
    const tareasEditables = tareas.filter(t => perfil.rol === 'admin' || t.creador_id === session.user.id)

    let tareasFiltradas = tareas;
    if (filtroVista === 'mis_tareas') {
      tareasFiltradas = tareas.filter(t => t.asignado_a === session.user.id)
    } else if (filtroVista === 'mi_area') {
      if (perfil.area === 'mecanica' || perfil.area === 'diseno') {
        tareasFiltradas = tareas.filter(t => t.area_asignado === 'mecanica' || t.area_asignado === 'diseno')
      } else {
        tareasFiltradas = tareas.filter(t => t.area_asignado === perfil.area)
      }
    } else if (['mecanica', 'electronica', 'administracion', 'diseno'].includes(filtroVista)) {
      tareasFiltradas = tareas.filter(t => t.area_asignado === filtroVista)
    }

    return (
      <div style={{ fontFamily: 'Arial, sans-serif', margin: '-8px', backgroundColor: '#f4f4f4', minHeight: '100vh', position: 'relative', boxSizing: 'border-box' }}>
        
        {/* BARRA DE NAVEGACIÓN ADAPTABLE */}
        <nav style={{ backgroundColor: COLOR_AZUL_TECNM, color: 'white', padding: '15px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
            <h2 style={{ margin: 0, paddingRight: '20px', borderRight: '2px solid white', color: '#FFFFFF', fontSize: '20px' }}>MOVITEC</h2>
            <button onClick={() => setVistaActual('tareas')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: vistaActual === 'tareas' ? 'bold' : 'normal', fontSize: '14px' }}>
              Visualizar Tareas
            </button>
            {(perfil.rol === 'admin' || perfil.rol === 'lider') && (
              <button onClick={() => setVistaActual('gestionarTareas')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: vistaActual === 'gestionarTareas' ? 'bold' : 'normal', fontSize: '14px' }}>
                Gestionar Tareas
              </button>
            )}
            {perfil.rol === 'admin' && (
              <button onClick={() => setVistaActual('usuarios')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: vistaActual === 'usuarios' ? 'bold' : 'normal', fontSize: '14px' }}>
                Usuarios
              </button>
            )}
          </div>

          <div className="menu-usuario-container" style={{ position: 'relative' }}>
            <button onClick={() => setMenuAbierto(!menuAbierto)} style={{ backgroundColor: COLOR_VERDE_MOVITEC, color: 'white', border: 'none', padding: '8px 12px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
              {perfil.nombre} ▼
            </button>
            {menuAbierto && (
              <div style={{ position: 'absolute', top: '110%', right: 0, backgroundColor: 'white', color: 'black', padding: '15px', borderRadius: '5px', boxShadow: '0px 4px 8px rgba(0,0,0,0.2)', minWidth: '170px', zIndex: 10 }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}><strong>Rol:</strong> {perfil.rol.toUpperCase()}</p>
                <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}><strong>Área:</strong> {formatearAreaVisual(perfil.area)}</p>
                <button onClick={() => { setVistaActual('cambiarPassword'); setMenuAbierto(false) }} style={{ backgroundColor: COLOR_AZUL_TECNM, color: 'white', border: 'none', padding: '8px', width: '100%', borderRadius: '4px', cursor: 'pointer', marginBottom: '8px', fontSize: '13px' }}>Cambiar Contraseña</button>
                <button onClick={cerrarSesion} style={{ backgroundColor: 'red', color: 'white', border: 'none', padding: '8px', width: '100%', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Cerrar Sesión</button>
              </div>
            )}
          </div>
        </nav>

        {/* CONTENEDOR PRINCIPAL FLUIDO */}
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box' }}>
          
          {vistaActual === 'tareas' && (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
                <h2 style={{ color: COLOR_AZUL_TECNM, margin: 0, fontSize: '22px' }}>Tablero de Tareas</h2>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: COLOR_AZUL_TECNM, fontSize: '14px' }}>Filtrar:</span>
                  
                  {(perfil.rol === 'admin' || perfil.rol === 'lider') ? (
                    <select value={filtroVista} onChange={(e) => setFiltroVista(e.target.value)} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}>
                      <option value="todas">Todas las Áreas</option>
                      <option value="mecanica">Área Mecánica</option>
                      <option value="electronica">Área Electrónica</option>
                      <option value="administracion">Área Administración</option>
                      <option value="diseno">Área Diseño</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      <button onClick={() => setFiltroVista('mis_tareas')} style={{ padding: '8px 12px', borderRadius: '5px', border: 'none', backgroundColor: filtroVista === 'mis_tareas' ? COLOR_VERDE_MOVITEC : '#ccc', color: filtroVista === 'mis_tareas' ? 'white' : 'black', cursor: 'pointer', fontSize: '13px' }}>Mis Tareas</button>
                      <button onClick={() => setFiltroVista('mi_area')} style={{ padding: '8px 12px', borderRadius: '5px', border: 'none', backgroundColor: filtroVista === 'mi_area' ? COLOR_AZUL_TECNM : '#ccc', color: filtroVista === 'mi_area' ? 'white' : 'black', cursor: 'pointer', fontSize: '13px' }}>Área ({formatearAreaVisual(perfil.area)})</button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* TABLERO KANBAN HORIZONTAL ADAPTABLE */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '15px', width: '100%', boxSizing: 'border-box' }}>
                {columnasKanban.map(columna => (
                  <div key={columna.estado} style={{ flex: '0 0 280px', backgroundColor: columna.fondo, padding: '15px', borderRadius: '8px', boxSizing: 'border-box' }}>
                    <h3 style={{ marginTop: 0, borderBottom: '2px solid rgba(0,0,0,0.1)', paddingBottom: '10px', color: '#333', fontSize: '15px' }}>
                      {columna.titulo}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {tareasFiltradas.filter(t => t.estado === columna.estado).map(tarea => {
                        const esMiTarea = tarea.asignado_a === session.user.id;
                        const esAdminOLider = perfil.rol === 'admin' || perfil.rol === 'lider';

                        return (
                          <div key={tarea.id} style={{ backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0px 2px 5px rgba(0,0,0,0.05)', borderLeft: `5px solid ${columna.borde}`, boxSizing: 'border-box' }}>
                            <h4 style={{ margin: '0 0 8px 0', color: COLOR_AZUL_TECNM, fontSize: '15px' }}>{tarea.titulo}</h4>
                            <p style={{ margin: '0 0 12px 0', color: '#555', fontSize: '13px', lineHeight: '1.4', wordBreak: 'break-word' }}>{tarea.descripcion}</p>
                            
                            <div style={{ fontSize: '12px', color: 'gray', borderTop: '1px solid #eee', paddingTop: '8px', marginBottom: '10px' }}>
                              <strong>Asignado:</strong> {obtenerNombreAsignado(tarea.asignado_a)} <br/>
                              <strong style={{ color: new Date(tarea.fecha_limite) < new Date() && tarea.estado !== 'Completada' ? 'red' : 'inherit' }}>
                                Fecha Límite: {tarea.fecha_limite || 'Sin fecha'}
                              </strong>
                            </div>

                            {perfil.rol === 'miembro' && esMiTarea && (
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                {tarea.estado === 'Asignada' && (
                                  <button onClick={() => cambiarEstadoTarea(tarea.id, 'En Proceso')} style={{ width: '100%', padding: '6px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Comenzar Tarea</button>
                                )}
                                {tarea.estado === 'En Proceso' && (
                                  <button onClick={() => cambiarEstadoTarea(tarea.id, 'Terminada')} style={{ width: '100%', padding: '6px', backgroundColor: 'orange', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Enviar a Revisión</button>
                                )}
                              </div>
                            )}

                            {esAdminOLider && (
                              <select 
                                value={tarea.estado} 
                                onChange={(e) => cambiarEstadoTarea(tarea.id, e.target.value)} 
                                style={{ width: '100%', padding: '5px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                              >
                                <option value="Asignada">Asignada</option>
                                <option value="En Proceso">En Proceso</option>
                                <option value="Terminada">Terminada (Revisión)</option>
                                <option value="Completada">Completada</option>
                              </select>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VISTAS DE FORMULARIOS RESPONSIVAS (ANCHO MÁXIMO FLUIDO) */}
          {vistaActual === 'gestionarTareas' && (
            <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0px 2px 10px rgba(0,0,0,0.1)', maxWidth: '500px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', borderBottom: '2px solid #eee', marginBottom: '25px' }}>
                <button onClick={() => cambiarSubVistaTarea('asignar')} style={{ flex: 1, padding: '10px 5px', background: 'none', border: 'none', borderBottom: subVistaTarea === 'asignar' ? `3px solid ${COLOR_VERDE_MOVITEC}` : 'none', fontWeight: subVistaTarea === 'asignar' ? 'bold' : 'normal', color: COLOR_AZUL_TECNM, cursor: 'pointer', fontSize: '13px' }}>Asignar</button>
                <button onClick={() => cambiarSubVistaTarea('actualizar')} style={{ flex: 1, padding: '10px 5px', background: 'none', border: 'none', borderBottom: subVistaTarea === 'actualizar' ? `3px solid ${COLOR_VERDE_MOVITEC}` : 'none', fontWeight: subVistaTarea === 'actualizar' ? 'bold' : 'normal', color: COLOR_AZUL_TECNM, cursor: 'pointer', fontSize: '13px' }}>Actualizar</button>
                <button onClick={() => cambiarSubVistaTarea('borrar')} style={{ flex: 1, padding: '10px 5px', background: 'none', border: 'none', borderBottom: subVistaTarea === 'borrar' ? `3px solid red` : 'none', fontWeight: subVistaTarea === 'borrar' ? 'bold' : 'normal', color: COLOR_AZUL_TECNM, cursor: 'pointer', fontSize: '13px' }}>Borrar</button>
              </div>

              {subVistaTarea === 'asignar' && (
                <form onSubmit={guardarTarea} style={{ display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                  <input type="text" placeholder="Título de la tarea" required value={formTarea.titulo} onChange={e => setFormTarea({...formTarea, titulo: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
                  <textarea placeholder="Descripción detallada..." required rows="4" value={formTarea.descripcion} onChange={e => setFormTarea({...formTarea, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', resize: 'none', width: '100%', boxSizing: 'border-box' }}></textarea>
                  <label style={{ fontSize: '14px', color: 'gray', marginBottom: '-8px' }}>Fecha Límite:</label>
                  <input type="date" required value={formTarea.fecha_limite} onChange={e => setFormTarea({...formTarea, fecha_limite: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
                  
                  <label style={{ fontSize: '14px', color: 'gray', marginBottom: '-8px' }}>Asignar a:</label>
                  <select required value={formTarea.asignado_a} onChange={e => setFormTarea({...formTarea, asignado_a: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }}>
                    <option value="">Selecciona un usuario...</option>
                    {usuariosEquipo.map(u => (
                      <option key={u.id} value={u.id}>{u.usuario} ({formatearAreaVisual(u.area)})</option>
                    ))}
                  </select>
                  <button type="submit" style={{ backgroundColor: COLOR_VERDE_MOVITEC, color: 'white', border: 'none', padding: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', width: '100%' }}>Guardar y Asignar Tarea</button>
                </form>
              )}

              {subVistaTarea === 'actualizar' && (
                <div>
                  {!modoEdicion ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {tareasEditables.map(t => (
                        <div key={t.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9', gap: '10px' }}>
                          <span style={{ fontWeight: 'bold', color: COLOR_AZUL_TECNM, wordBreak: 'break-word', flex: 1 }}>{t.titulo}</span>
                          <button onClick={() => { setFormTarea(t); setModoEdicion(true); }} style={{ backgroundColor: COLOR_AZUL_TECNM, color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Editar</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <form onSubmit={guardarTarea} style={{ display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                      <input type="text" required value={formTarea.titulo} onChange={e => setFormTarea({...formTarea, titulo: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
                      <textarea required rows="4" value={formTarea.descripcion} onChange={e => setFormTarea({...formTarea, descripcion: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', resize: 'none', width: '100%', boxSizing: 'border-box' }}></textarea>
                      <input type="date" required value={formTarea.fecha_limite} onChange={e => setFormTarea({...formTarea, fecha_limite: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
                      <select required value={formTarea.asignado_a} onChange={e => setFormTarea({...formTarea, asignado_a: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }}>
                        {usuariosEquipo.map(u => <option key={u.id} value={u.id}>{u.usuario} ({formatearAreaVisual(u.area)})</option>)}
                      </select>
                      <select value={formTarea.estado} onChange={e => setFormTarea({...formTarea, estado: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }}>
                        <option value="Asignada">Asignada</option>
                        <option value="En Proceso">En Proceso</option>
                        <option value="Terminada">Terminada (Revisión)</option>
                        <option value="Completada">Completada</option>
                      </select>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button type="button" onClick={() => setModoEdicion(false)} style={{ flex: 1, backgroundColor: 'gray', color: 'white', border: 'none', padding: '12px', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" style={{ flex: 1, backgroundColor: COLOR_VERDE_MOVITEC, color: 'white', border: 'none', padding: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Actualizar</button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {subVistaTarea === 'borrar' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tareasEditables.map(t => (
                    <div key={t.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9', gap: '10px' }}>
                      <span style={{ fontWeight: 'bold', color: COLOR_AZUL_TECNM, wordBreak: 'break-word', flex: 1 }}>{t.titulo}</span>
                      <button onClick={() => eliminarTarea(t.id)} style={{ backgroundColor: 'red', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Eliminar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {vistaActual === 'usuarios' && (
            <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0px 2px 10px rgba(0,0,0,0.1)', maxWidth: '600px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
              
              <div style={{ display: 'flex', borderBottom: '2px solid #eee', marginBottom: '25px' }}>
                <button onClick={() => setSubVistaUsuario('lista')} style={{ flex: 1, padding: '10px 5px', background: 'none', border: 'none', borderBottom: subVistaUsuario === 'lista' ? `3px solid ${COLOR_VERDE_MOVITEC}` : 'none', fontWeight: subVistaUsuario === 'lista' ? 'bold' : 'normal', color: COLOR_AZUL_TECNM, cursor: 'pointer', fontSize: '13px' }}>Lista</button>
                <button onClick={() => setSubVistaUsuario('agregar')} style={{ flex: 1, padding: '10px 5px', background: 'none', border: 'none', borderBottom: subVistaUsuario === 'agregar' ? `3px solid ${COLOR_VERDE_MOVITEC}` : 'none', fontWeight: subVistaUsuario === 'agregar' ? 'bold' : 'normal', color: COLOR_AZUL_TECNM, cursor: 'pointer', fontSize: '13px' }}>Agregar</button>
              </div>

              {subVistaUsuario === 'lista' && (
                <div>
                  <h3 style={{ color: COLOR_AZUL_TECNM, marginTop: 0 }}>Integrantes de Movitec</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                    {usuariosEquipo.map(u => (
                      <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #eee', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
                        <div>
                          <strong style={{ color: COLOR_AZUL_TECNM }}>{u.nombre}</strong> ({u.usuario})<br/>
                          <span style={{ fontSize: '13px', color: 'gray' }}>Área: {formatearAreaVisual(u.area)} | Rol: {u.rol.toUpperCase()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {subVistaUsuario === 'agregar' && (
                <div>
                  <h3 style={{ color: COLOR_AZUL_TECNM, marginTop: 0 }}>Alta de Usuarios</h3>
                  <p style={{ fontSize: '13px', color: 'gray', marginBottom: '15px' }}>Recuerda dar de alta primero el correo y la contraseña en Supabase.</p>
                  
                  <form onSubmit={registrarUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                    <input type="text" placeholder="Usuario (ej. ana.lopez)" required value={formUser.usuario} onChange={e => setFormUser({...formUser, usuario: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
                    <input type="text" placeholder="Nombre completo" required value={formUser.nombre} onChange={e => setFormUser({...formUser, nombre: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
                    <input type="email" placeholder="Correo electrónico" required value={formUser.email} onChange={e => setFormUser({...formUser, email: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
                    <input type="text" placeholder="Celular (Opcional)" value={formUser.celular} onChange={e => setFormUser({...formUser, celular: e.target.value})} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      <select value={formUser.area} onChange={e => setFormUser({...formUser, area: e.target.value})} style={{ flex: 1, minWidth: '130px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
                        <option value="mecanica">Mecánica</option>
                        <option value="electronica">Electrónica</option>
                        <option value="administracion">Administración</option>
                        <option value="diseno">Diseño</option>
                      </select>
                      <select value={formUser.rol} onChange={e => setFormUser({...formUser, rol: e.target.value})} style={{ flex: 1, minWidth: '130px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
                        <option value="miembro">Miembro</option>
                        <option value="lider">Líder</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                    <button type="submit" style={{ backgroundColor: COLOR_VERDE_MOVITEC, color: 'white', border: 'none', padding: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>Enlazar Integrante</button>
                  </form>
                  {mensajeRegistro && <p style={{ color: mensajeRegistro.includes('Error') ? 'red' : 'green', fontWeight: 'bold', textAlign: 'center' }}>{mensajeRegistro}</p>}
                </div>
              )}
            </div>
          )}

          {vistaActual === 'cambiarPassword' && (
             <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0px 2px 10px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
             <h2 style={{ color: COLOR_AZUL_TECNM, marginTop: 0 }}>Cambiar Contraseña</h2>
             <form onSubmit={actualizarPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
               <input type="password" placeholder="Contraseña actual" required value={passwordActual} onChange={e => setPasswordActual(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
               <input type="password" placeholder="Nueva contraseña (mín. 6 caracteres)" required value={nuevaPassword} onChange={e => setNuevaPassword(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
               <button type="submit" style={{ backgroundColor: COLOR_VERDE_MOVITEC, color: 'white', border: 'none', padding: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>Actualizar Contraseña</button>
             </form>
             {mensajePassword && <p style={{ color: mensajePassword.includes('Error') ? 'red' : 'green', fontWeight: 'bold', textAlign: 'center' }}>{mensajePassword}</p>}
           </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f4f4', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', textAlign: 'center', width: '100%', maxWidth: '350px', boxSizing: 'border-box' }}>
        <h1 style={{ color: COLOR_AZUL_TECNM, margin: '0 0 10px 0', fontSize: '26px' }}>MOVITEC</h1>
        <h3 style={{ color: 'gray', margin: '0 0 25px 0', fontSize: '16px' }}>Iniciar Sesión</h3>
        <form onSubmit={iniciarSesion} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input type="email" placeholder="Correo electrónico" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
          <input type="password" placeholder="Contraseña" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box' }} />
          <button type="submit" style={{ backgroundColor: COLOR_VERDE_MOVITEC, color: 'white', border: 'none', padding: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>Entrar</button>
        </form>
        <p style={{ color: 'red', fontSize: '14px', marginTop: '15px' }}>{mensaje}</p>
      </div>
    </div>
  )
}

export default App