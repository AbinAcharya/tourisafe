/*
 * Tourisafe lightweight i18n.
 *
 * Stable keys -> per-language strings. Logic elsewhere keys off STABLE TOKENS
 * (safe/caution/restricted/high-risk, message keys) and never off the displayed
 * text, so translating a string can never change behaviour.
 *
 * t(key, params)   -> resolves a key for the current language, {param} interpolated.
 * apply(root)      -> translates all [data-i18n] (textContent) and
 *                     [data-i18n-attr="attr:key;attr2:key2"] (attributes) under root.
 * setLang(code)    -> switches language and sets <html lang>.
 *
 * SAFETY-CRITICAL STRINGS — flagged for native-speaker review before production:
 *   sos.title, sos.copy, sos.hold, sos.release, sos.sentBody,
 *   alert.restrictedArea, alert.highRiskArea, alert.enteredFence,
 *   alert.youEnteredFence, alert.insideArea, emergency.call, status.startBeforeSos.
 * The HI/ES values below are a best-effort first pass, not a certified translation.
 */
(function () {
  const DICT = {
    en: {
      'brand.tagline': 'Personal safety',
      'btn.createAccount': 'Create account',
      'btn.signIn': 'Sign in',
      'btn.startTracking': 'Start tracking',
      'btn.stopTracking': 'Stop tracking',
      'session.tourist': 'Tourist',
      'session.signOut': 'Sign out',
      'aria.notifications': 'Notifications',
      'aria.openNotifications': 'Open notifications',
      'aria.settings': 'Settings',
      'aria.openSettings': 'Open settings',
      'aria.dismissAlert': 'Dismiss safety alert',
      'aria.call': 'Call {name}',
      'aria.remove': 'Remove {name}',

      'dash.currentArea': 'Current area',
      'safety.safe': 'Safe',
      'safety.caution': 'Caution',
      'safety.restricted': 'Restricted',
      'safety.highRisk': 'High risk',
      'safety.noAlerts': 'No active local alerts',

      'trip.start': 'Start trip',
      'trip.end': 'End trip',
      'trip.share': 'Share trip',
      'trip.copyLink': 'Copy trip link',
      'trip.activeTitle': 'Trip check-in active',
      'trip.activeBody': 'Your safety session is ready.',
      'trip.endedTitle': 'Trip ended',
      'trip.endedBody': 'Your session has been closed.',
      'trip.copiedTitle': 'Trip status copied',
      'trip.copiedBody': 'Share it with someone you trust.',
      'trip.shareTitle': 'Tourisafe trip',
      'trip.statusText': 'Tourisafe trip status: {state}',
      'trip.stateActive': 'active',
      'trip.stateInactive': 'not active',

      'tool.zoomIn': 'Zoom in',
      'tool.zoomOut': 'Zoom out',
      'tool.locate': 'Use my location',
      'tool.resetView': 'Reset map view',
      'tool.fullscreen': 'Toggle fullscreen map',
      'tool.legend': 'Map legend',

      'legend.title': 'Map legend',
      'legend.safe': 'Safe area',
      'legend.caution': 'Caution area',
      'legend.danger': 'Restricted or high-risk',
      'legend.location': 'Your location',
      'legend.close': 'Close map legend',

      'status.readyTitle': 'Ready when you are',
      'status.readyDetail': 'Location tracking is off',
      'status.online': 'Online',
      'status.offline': 'Offline',
      'status.requesting': 'Requesting location...',
      'status.sharing': 'Location sharing active',
      'status.permNeeded': 'Location permission needed',
      'status.unavailable': 'Location unavailable',
      'status.geoUnavailable': 'Geolocation not available',
      'status.stopped': 'Stopped telemetry',
      'status.connLost': 'Connection lost',
      'status.startToLocate': 'Start tracking to locate yourself',
      'status.signedOut': 'Signed out',
      'status.loggedIn': 'Logged in',
      'status.registered': 'Registered id={id}',
      'status.regFailed': 'Register failed',
      'status.loginFailed': 'Login failed: {detail}',
      'status.loginError': 'Login error: {msg}',
      'status.telemetryError': 'Telemetry error: {detail}',
      'status.sosError': 'SOS error: {detail}',
      'status.sosSent': 'SOS sent: incident {id}',
      'status.startBeforeSos': 'Start tracking before sending an SOS',
      'status.incidentReported': 'Incident reported',
      'status.enteredArea': 'Entered {zone}: {name}',
      'status.zoneFence': '{zone}: {fence}',
      'metrics.accuracy': '{m}m accuracy',

      'emergency.call': '112 Emergency',
      'emergency.callAria': 'Call emergency services',
      'emergency.hospital': 'Find hospital',
      'emergency.fab': 'Emergency',

      'timeline.title': 'Safety timeline',
      'timeline.readyTitle': 'Ready to track',
      'timeline.readyDetail': 'Start location sharing when you are ready',

      'notif.feed': 'Safety feed',
      'notif.title': 'Notifications',
      'notif.clear': 'Clear',
      'notif.empty': 'No new activity',

      'kit.kicker': 'Your safety kit',
      'kit.title': 'Safety tools',
      'kit.close': 'Close safety tools',
      'kit.nearbyHelp': 'Nearby help',
      'kit.nearbyHelpDetail': 'Find hospitals, police and pharmacies',
      'kit.contacts': 'Trusted contacts',

      'pref.kicker': 'Preferences',
      'pref.largeText': 'Large text',
      'pref.darkMap': 'Dark map',
      'pref.language': 'Language',

      'contacts.none': 'No contacts saved',
      'contacts.savedOne': '{n} contact saved',
      'contacts.savedMany': '{n} contacts saved',
      'contacts.kicker': 'Stay connected',
      'contacts.title': 'Trusted contacts',
      'contacts.close': 'Close trusted contacts',
      'contacts.copy': 'Saved on this device and ready to call in an emergency.',
      'contacts.empty': 'Add someone you trust.',
      'contacts.name': 'Name',
      'contacts.phone': 'Phone number',
      'contacts.add': 'Add',

      'sos.title': 'Send an SOS?',
      'sos.copy': 'Your current location will be shared with Tourisafe responders.',
      'sos.hold': 'Press and hold for 3 seconds',
      'sos.release': 'Release to send SOS',
      'sos.cancel': 'Cancel',
      'sos.sentTitle': 'SOS sent',
      'sos.sentBody': 'Incident {id}',

      'auth.login': 'Login',
      'auth.register': 'Register',
      'auth.username': 'Username',
      'auth.email': 'Email (for register)',
      'auth.password': 'Password',
      'auth.cancel': 'Cancel',
      'auth.submit': 'Submit',
      'auth.or': 'or',

      'alert.incidentTitle': 'Incident reported',
      'alert.incidentBodyDefault': 'An incident was reported nearby',
      'alert.anomalyTitle': 'Telemetry anomaly',
      'alert.anomalyBody': 'User {user} speed {speed}',
      'alert.restrictedArea': 'Restricted area',
      'alert.highRiskArea': 'High-risk area',
      'alert.enteredFence': 'Entered {fence}',
      'alert.youEnteredFence': 'You entered {fence}',
      'alert.insideArea': 'You are inside {zone}: {name}',

      'ob.welcome': 'Welcome to Tourisafe',
      'ob.intro': "Explore with confidence — here's how Tourisafe looks out for you.",
      'ob.zoneTitle': 'Live zone alerts',
      'ob.zoneDetail': 'Get warned the moment you approach a high-risk or restricted area.',
      'ob.sosTitle': 'One-tap SOS',
      'ob.sosDetail': 'Press and hold the SOS button to send responders your live location.',
      'ob.statusTitle': 'Real-time status',
      'ob.statusDetail': 'Start tracking to watch your safety status update as you move.',
      'ob.cta': 'Get started',
    },

    hi: {
      'brand.tagline': 'व्यक्तिगत सुरक्षा',
      'btn.createAccount': 'खाता बनाएँ',
      'btn.signIn': 'साइन इन करें',
      'btn.startTracking': 'ट्रैकिंग शुरू करें',
      'btn.stopTracking': 'ट्रैकिंग रोकें',
      'session.tourist': 'पर्यटक',
      'session.signOut': 'साइन आउट',
      'aria.notifications': 'सूचनाएँ',
      'aria.openNotifications': 'सूचनाएँ खोलें',
      'aria.settings': 'सेटिंग्स',
      'aria.openSettings': 'सेटिंग्स खोलें',
      'aria.dismissAlert': 'सुरक्षा अलर्ट खारिज करें',
      'aria.call': '{name} को कॉल करें',
      'aria.remove': '{name} हटाएँ',

      'dash.currentArea': 'वर्तमान क्षेत्र',
      'safety.safe': 'सुरक्षित',
      'safety.caution': 'सावधान',
      'safety.restricted': 'प्रतिबंधित',
      'safety.highRisk': 'उच्च जोखिम',
      'safety.noAlerts': 'कोई सक्रिय स्थानीय अलर्ट नहीं',

      'trip.start': 'यात्रा शुरू करें',
      'trip.end': 'यात्रा समाप्त करें',
      'trip.share': 'यात्रा साझा करें',
      'trip.copyLink': 'यात्रा लिंक कॉपी करें',
      'trip.activeTitle': 'यात्रा चेक-इन सक्रिय',
      'trip.activeBody': 'आपका सुरक्षा सत्र तैयार है।',
      'trip.endedTitle': 'यात्रा समाप्त',
      'trip.endedBody': 'आपका सत्र बंद कर दिया गया है।',
      'trip.copiedTitle': 'यात्रा स्थिति कॉपी की गई',
      'trip.copiedBody': 'इसे किसी विश्वसनीय व्यक्ति के साथ साझा करें।',
      'trip.shareTitle': 'Tourisafe यात्रा',
      'trip.statusText': 'Tourisafe यात्रा स्थिति: {state}',
      'trip.stateActive': 'सक्रिय',
      'trip.stateInactive': 'निष्क्रिय',

      'tool.zoomIn': 'ज़ूम इन',
      'tool.zoomOut': 'ज़ूम आउट',
      'tool.locate': 'मेरा स्थान उपयोग करें',
      'tool.resetView': 'मानचित्र दृश्य रीसेट करें',
      'tool.fullscreen': 'पूर्ण स्क्रीन मानचित्र टॉगल करें',
      'tool.legend': 'मानचित्र लेजेंड',

      'legend.title': 'मानचित्र लेजेंड',
      'legend.safe': 'सुरक्षित क्षेत्र',
      'legend.caution': 'सावधानी क्षेत्र',
      'legend.danger': 'प्रतिबंधित या उच्च जोखिम',
      'legend.location': 'आपका स्थान',
      'legend.close': 'मानचित्र लेजेंड बंद करें',

      'status.readyTitle': 'जब आप तैयार हों',
      'status.readyDetail': 'स्थान ट्रैकिंग बंद है',
      'status.online': 'ऑनलाइन',
      'status.offline': 'ऑफ़लाइन',
      'status.requesting': 'स्थान का अनुरोध किया जा रहा है...',
      'status.sharing': 'स्थान साझाकरण सक्रिय',
      'status.permNeeded': 'स्थान अनुमति आवश्यक',
      'status.unavailable': 'स्थान अनुपलब्ध',
      'status.geoUnavailable': 'जियोलोकेशन उपलब्ध नहीं',
      'status.stopped': 'ट्रैकिंग रोकी गई',
      'status.connLost': 'कनेक्शन टूट गया',
      'status.startToLocate': 'स्वयं को खोजने के लिए ट्रैकिंग शुरू करें',
      'status.signedOut': 'साइन आउट हो गए',
      'status.loggedIn': 'लॉग इन हो गए',
      'status.registered': 'पंजीकृत id={id}',
      'status.regFailed': 'पंजीकरण विफल',
      'status.loginFailed': 'लॉगिन विफल: {detail}',
      'status.loginError': 'लॉगिन त्रुटि: {msg}',
      'status.telemetryError': 'टेलीमेट्री त्रुटि: {detail}',
      'status.sosError': 'SOS त्रुटि: {detail}',
      'status.sosSent': 'SOS भेजा गया: घटना {id}',
      'status.startBeforeSos': 'SOS भेजने से पहले ट्रैकिंग शुरू करें',
      'status.incidentReported': 'घटना दर्ज की गई',
      'status.enteredArea': '{zone} में प्रवेश: {name}',
      'status.zoneFence': '{zone}: {fence}',
      'metrics.accuracy': '{m}मी सटीकता',

      'emergency.call': '112 आपातकाल',
      'emergency.callAria': 'आपातकालीन सेवाओं को कॉल करें',
      'emergency.hospital': 'अस्पताल खोजें',
      'emergency.fab': 'आपातकाल',

      'timeline.title': 'सुरक्षा टाइमलाइन',
      'timeline.readyTitle': 'ट्रैक करने के लिए तैयार',
      'timeline.readyDetail': 'तैयार होने पर स्थान साझा करना शुरू करें',

      'notif.feed': 'सुरक्षा फ़ीड',
      'notif.title': 'सूचनाएँ',
      'notif.clear': 'साफ़ करें',
      'notif.empty': 'कोई नई गतिविधि नहीं',

      'kit.kicker': 'आपकी सुरक्षा किट',
      'kit.title': 'सुरक्षा उपकरण',
      'kit.close': 'सुरक्षा उपकरण बंद करें',
      'kit.nearbyHelp': 'नज़दीकी मदद',
      'kit.nearbyHelpDetail': 'अस्पताल, पुलिस और फार्मेसी खोजें',
      'kit.contacts': 'विश्वसनीय संपर्क',

      'pref.kicker': 'प्राथमिकताएँ',
      'pref.largeText': 'बड़ा टेक्स्ट',
      'pref.darkMap': 'डार्क मानचित्र',
      'pref.language': 'भाषा',

      'contacts.none': 'कोई संपर्क सहेजा नहीं गया',
      'contacts.savedOne': '{n} संपर्क सहेजा गया',
      'contacts.savedMany': '{n} संपर्क सहेजे गए',
      'contacts.kicker': 'जुड़े रहें',
      'contacts.title': 'विश्वसनीय संपर्क',
      'contacts.close': 'विश्वसनीय संपर्क बंद करें',
      'contacts.copy': 'इस डिवाइस पर सहेजा गया और आपात स्थिति में कॉल के लिए तैयार।',
      'contacts.empty': 'किसी विश्वसनीय व्यक्ति को जोड़ें।',
      'contacts.name': 'नाम',
      'contacts.phone': 'फ़ोन नंबर',
      'contacts.add': 'जोड़ें',

      'sos.title': 'SOS भेजें?',
      'sos.copy': 'आपका वर्तमान स्थान Tourisafe रिस्पॉन्डर्स के साथ साझा किया जाएगा।',
      'sos.hold': '3 सेकंड तक दबाकर रखें',
      'sos.release': 'SOS भेजने के लिए छोड़ें',
      'sos.cancel': 'रद्द करें',
      'sos.sentTitle': 'SOS भेजा गया',
      'sos.sentBody': 'घटना {id}',

      'auth.login': 'लॉगिन',
      'auth.register': 'पंजीकरण',
      'auth.username': 'उपयोगकर्ता नाम',
      'auth.email': 'ईमेल (पंजीकरण के लिए)',
      'auth.password': 'पासवर्ड',
      'auth.cancel': 'रद्द करें',
      'auth.submit': 'सबमिट करें',
      'auth.or': 'या',

      'alert.incidentTitle': 'घटना दर्ज की गई',
      'alert.incidentBodyDefault': 'पास में एक घटना दर्ज की गई',
      'alert.anomalyTitle': 'टेलीमेट्री विसंगति',
      'alert.anomalyBody': 'उपयोगकर्ता {user} गति {speed}',
      'alert.restrictedArea': 'प्रतिबंधित क्षेत्र',
      'alert.highRiskArea': 'उच्च जोखिम क्षेत्र',
      'alert.enteredFence': '{fence} में प्रवेश किया',
      'alert.youEnteredFence': 'आपने {fence} में प्रवेश किया',
      'alert.insideArea': 'आप {zone} में हैं: {name}',

      'ob.welcome': 'Tourisafe में आपका स्वागत है',
      'ob.intro': 'आत्मविश्वास से घूमें — जानें Tourisafe आपकी सुरक्षा कैसे करता है।',
      'ob.zoneTitle': 'लाइव ज़ोन अलर्ट',
      'ob.zoneDetail': 'जैसे ही आप उच्च जोखिम या प्रतिबंधित क्षेत्र के पास पहुँचें, चेतावनी पाएँ।',
      'ob.sosTitle': 'एक-टैप SOS',
      'ob.sosDetail': 'रिस्पॉन्डर्स को अपना लाइव स्थान भेजने के लिए SOS बटन दबाकर रखें।',
      'ob.statusTitle': 'रीयल-टाइम स्थिति',
      'ob.statusDetail': 'चलते समय अपनी सुरक्षा स्थिति देखने के लिए ट्रैकिंग शुरू करें।',
      'ob.cta': 'शुरू करें',
    },

    es: {
      'brand.tagline': 'Seguridad personal',
      'btn.createAccount': 'Crear cuenta',
      'btn.signIn': 'Iniciar sesión',
      'btn.startTracking': 'Iniciar rastreo',
      'btn.stopTracking': 'Detener rastreo',
      'session.tourist': 'Turista',
      'session.signOut': 'Cerrar sesión',
      'aria.notifications': 'Notificaciones',
      'aria.openNotifications': 'Abrir notificaciones',
      'aria.settings': 'Ajustes',
      'aria.openSettings': 'Abrir ajustes',
      'aria.dismissAlert': 'Descartar alerta de seguridad',
      'aria.call': 'Llamar a {name}',
      'aria.remove': 'Eliminar a {name}',

      'dash.currentArea': 'Área actual',
      'safety.safe': 'Seguro',
      'safety.caution': 'Precaución',
      'safety.restricted': 'Restringido',
      'safety.highRisk': 'Alto riesgo',
      'safety.noAlerts': 'Sin alertas locales activas',

      'trip.start': 'Iniciar viaje',
      'trip.end': 'Finalizar viaje',
      'trip.share': 'Compartir viaje',
      'trip.copyLink': 'Copiar enlace del viaje',
      'trip.activeTitle': 'Registro de viaje activo',
      'trip.activeBody': 'Tu sesión de seguridad está lista.',
      'trip.endedTitle': 'Viaje finalizado',
      'trip.endedBody': 'Tu sesión se ha cerrado.',
      'trip.copiedTitle': 'Estado del viaje copiado',
      'trip.copiedBody': 'Compártelo con alguien de confianza.',
      'trip.shareTitle': 'Viaje de Tourisafe',
      'trip.statusText': 'Estado del viaje Tourisafe: {state}',
      'trip.stateActive': 'activo',
      'trip.stateInactive': 'no activo',

      'tool.zoomIn': 'Acercar',
      'tool.zoomOut': 'Alejar',
      'tool.locate': 'Usar mi ubicación',
      'tool.resetView': 'Restablecer vista del mapa',
      'tool.fullscreen': 'Alternar mapa en pantalla completa',
      'tool.legend': 'Leyenda del mapa',

      'legend.title': 'Leyenda del mapa',
      'legend.safe': 'Área segura',
      'legend.caution': 'Área de precaución',
      'legend.danger': 'Restringida o de alto riesgo',
      'legend.location': 'Tu ubicación',
      'legend.close': 'Cerrar leyenda del mapa',

      'status.readyTitle': 'Listo cuando tú lo estés',
      'status.readyDetail': 'El rastreo de ubicación está desactivado',
      'status.online': 'En línea',
      'status.offline': 'Sin conexión',
      'status.requesting': 'Solicitando ubicación...',
      'status.sharing': 'Compartir ubicación activo',
      'status.permNeeded': 'Se necesita permiso de ubicación',
      'status.unavailable': 'Ubicación no disponible',
      'status.geoUnavailable': 'Geolocalización no disponible',
      'status.stopped': 'Rastreo detenido',
      'status.connLost': 'Conexión perdida',
      'status.startToLocate': 'Inicia el rastreo para ubicarte',
      'status.signedOut': 'Sesión cerrada',
      'status.loggedIn': 'Sesión iniciada',
      'status.registered': 'Registrado id={id}',
      'status.regFailed': 'Error al registrarse',
      'status.loginFailed': 'Error al iniciar sesión: {detail}',
      'status.loginError': 'Error de inicio de sesión: {msg}',
      'status.telemetryError': 'Error de telemetría: {detail}',
      'status.sosError': 'Error de SOS: {detail}',
      'status.sosSent': 'SOS enviado: incidente {id}',
      'status.startBeforeSos': 'Inicia el rastreo antes de enviar un SOS',
      'status.incidentReported': 'Incidente reportado',
      'status.enteredArea': 'Entraste en {zone}: {name}',
      'status.zoneFence': '{zone}: {fence}',
      'metrics.accuracy': '{m} m de precisión',

      'emergency.call': '112 Emergencia',
      'emergency.callAria': 'Llamar a servicios de emergencia',
      'emergency.hospital': 'Buscar hospital',
      'emergency.fab': 'Emergencia',

      'timeline.title': 'Cronología de seguridad',
      'timeline.readyTitle': 'Listo para rastrear',
      'timeline.readyDetail': 'Comparte tu ubicación cuando estés listo',

      'notif.feed': 'Feed de seguridad',
      'notif.title': 'Notificaciones',
      'notif.clear': 'Borrar',
      'notif.empty': 'Sin actividad nueva',

      'kit.kicker': 'Tu kit de seguridad',
      'kit.title': 'Herramientas de seguridad',
      'kit.close': 'Cerrar herramientas de seguridad',
      'kit.nearbyHelp': 'Ayuda cercana',
      'kit.nearbyHelpDetail': 'Encuentra hospitales, policía y farmacias',
      'kit.contacts': 'Contactos de confianza',

      'pref.kicker': 'Preferencias',
      'pref.largeText': 'Texto grande',
      'pref.darkMap': 'Mapa oscuro',
      'pref.language': 'Idioma',

      'contacts.none': 'Sin contactos guardados',
      'contacts.savedOne': '{n} contacto guardado',
      'contacts.savedMany': '{n} contactos guardados',
      'contacts.kicker': 'Mantente conectado',
      'contacts.title': 'Contactos de confianza',
      'contacts.close': 'Cerrar contactos de confianza',
      'contacts.copy': 'Guardados en este dispositivo y listos para llamar en una emergencia.',
      'contacts.empty': 'Agrega a alguien de confianza.',
      'contacts.name': 'Nombre',
      'contacts.phone': 'Número de teléfono',
      'contacts.add': 'Agregar',

      'sos.title': '¿Enviar un SOS?',
      'sos.copy': 'Tu ubicación actual se compartirá con los equipos de respuesta de Tourisafe.',
      'sos.hold': 'Mantén pulsado 3 segundos',
      'sos.release': 'Suelta para enviar el SOS',
      'sos.cancel': 'Cancelar',
      'sos.sentTitle': 'SOS enviado',
      'sos.sentBody': 'Incidente {id}',

      'auth.login': 'Iniciar sesión',
      'auth.register': 'Registrarse',
      'auth.username': 'Nombre de usuario',
      'auth.email': 'Correo (para registrarse)',
      'auth.password': 'Contraseña',
      'auth.cancel': 'Cancelar',
      'auth.submit': 'Enviar',
      'auth.or': 'o',

      'alert.incidentTitle': 'Incidente reportado',
      'alert.incidentBodyDefault': 'Se reportó un incidente cerca',
      'alert.anomalyTitle': 'Anomalía de telemetría',
      'alert.anomalyBody': 'Usuario {user} velocidad {speed}',
      'alert.restrictedArea': 'Área restringida',
      'alert.highRiskArea': 'Área de alto riesgo',
      'alert.enteredFence': 'Entraste en {fence}',
      'alert.youEnteredFence': 'Entraste en {fence}',
      'alert.insideArea': 'Estás dentro de {zone}: {name}',

      'ob.welcome': 'Bienvenido a Tourisafe',
      'ob.intro': 'Explora con confianza: así te cuida Tourisafe.',
      'ob.zoneTitle': 'Alertas de zona en vivo',
      'ob.zoneDetail': 'Recibe un aviso en cuanto te acerques a una zona restringida o de alto riesgo.',
      'ob.sosTitle': 'SOS con un toque',
      'ob.sosDetail': 'Mantén pulsado el botón SOS para enviar tu ubicación en vivo a los equipos de respuesta.',
      'ob.statusTitle': 'Estado en tiempo real',
      'ob.statusDetail': 'Inicia el rastreo para ver cómo se actualiza tu estado de seguridad mientras te mueves.',
      'ob.cta': 'Comenzar',
    },
  };

  let current = 'en';

  function resolve(lang) {
    return DICT[lang] ? lang : 'en';
  }

  function t(key, params) {
    const lang = current;
    let s = DICT[lang] && DICT[lang][key];
    if (s == null) s = DICT.en[key] != null ? DICT.en[key] : key;
    if (params) {
      for (const k in params) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
      }
    }
    return s;
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        const parts = pair.split(':');
        const attr = (parts[0] || '').trim();
        const key = (parts[1] || '').trim();
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
  }

  function setLang(code) {
    current = resolve(code);
    if (document.documentElement) document.documentElement.lang = current;
  }

  function getLang() {
    return current;
  }

  window.TouriSafe = window.TouriSafe || {};
  window.TouriSafe.i18n = { t: t, apply: apply, setLang: setLang, getLang: getLang };
})();
