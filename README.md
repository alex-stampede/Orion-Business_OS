# Orion Business OS

**Orion Business OS** es una aplicación web SaaS diseñada para que pequeñas empresas, freelancers y equipos comerciales puedan **gestionar su negocio desde un solo lugar**.

El sistema permite administrar:

- Leads
- Clientes
- Cotizaciones profesionales
- Pipeline de ventas
- Actividad comercial
- Configuración de negocio

Todo dentro de una **SPA rápida, ligera y moderna**.

---

# 🚀 Características

## Gestión de Leads
- Registro de leads
- Seguimiento de oportunidades
- Conversión automática a cliente
- Actividad registrada en el historial

## Gestión de Clientes
- Base de clientes centralizada
- Información de contacto
- Historial comercial

## Sistema de Cotizaciones
- Creación de cotizaciones profesionales
- Generación de PDF
- Temas de color personalizables (Plan Pro)
- Folios automáticos
- Impuestos configurables
- Conversión de lead a cliente al ganar la cotización

## Pipeline Comercial
Visualización del proceso de ventas:

- Lead
- Contactado
- Cotización
- Negociación
- Ganado
- Perdido

## Dashboard
Métricas en tiempo real:

- Cotizaciones totales
- Monto cotizado
- Tasa de cierre
- Actividad reciente

## Planes Freemium
El sistema opera bajo modelo freemium:

### Plan Inicio (Free)

- 3 Leads
- 3 Clientes
- 3 Cotizaciones
- Tema estándar Orion

### Plan Pro

- Leads ilimitados
- Clientes ilimitados
- Cotizaciones ilimitadas
- Eliminación de registros
- Personalización de tema de cotización

---

# 🧠 Arquitectura

Orion Business OS fue diseñado como **Single Page Application (SPA)**.

## Frontend

- Vanilla JavaScript
- Arquitectura modular
- Sistema de router basado en hash
- Render dinámico de módulos

Estructura:
public/
js/
modules/
services/
state.js
router.js

---

## Backend

El backend se compone de servicios serverless:

### Firebase

- Authentication
- Firestore (multi-tenant)
- Seguridad por reglas

### Netlify Functions

Funciones utilizadas:

- create-checkout-session
- create-portal-session
- stripe-webhook

---

## Base de datos

Estructura multi-tenant:
users
businesses
{businessId}
clients
leads
quotes
items
activities
settings

Cada negocio opera en su propio espacio aislado.

---

# 💳 Sistema de pagos

Integración con **Stripe Billing**.

Permite:

- Suscripción mensual
- Upgrade a plan Pro
- Cancelación desde portal de cliente
- Sincronización automática de plan vía webhook

---

# 🎨 Personalización de cotizaciones

Usuarios **Pro** pueden seleccionar temas de color para sus cotizaciones:

- Verde Orion
- Negro
- Azul
- Rojo
- Amarillo
- Naranja
- Morado
- Rosa

Las cotizaciones pueden exportarse a **PDF profesional listo para enviar al cliente**.

---

# 🔐 Seguridad

- Autenticación con Firebase
- Validación de tokens en funciones serverless
- Separación de datos por negocio
- Reglas de Firestore

---

# ⚙️ Tecnologías

Frontend:

- JavaScript
- HTML
- CSS

Backend:

- Firebase
- Firestore
- Netlify Functions

Pagos:

- Stripe

Infraestructura:

- Netlify
- GitHub

---

# 📦 Deploy

El sistema se despliega automáticamente mediante **Netlify**.

Flujo:
GitHub → Netlify → Deploy automático

Las funciones serverless se ubican en:
netlify/functions

---

# 🌐 Dominio

Aplicación:
https://orionbusiness.app

---

# 👨‍💻 Autor

Desarrollado por:

**Jonathan Alejandro Naranjo Rodriguez**

---

# 📄 Licencia

GPL-3.0
