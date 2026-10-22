import styles from './adminPage.module.css'

export default function AdminDashboardPage() {
  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Cola de Borradores</h1>
          <p className={styles.subtitle}>
            Supervisión y aprobación editorial de los puzles generados por el agente IA.
          </p>
        </div>
      </div>

      <div className={styles.emptyCard}>
        <h2 className={styles.emptyTitle}>Panel Editorial Inicializado</h2>
        <p className={styles.emptyText}>
          El entorno administrativo de Next.js 15 y Supabase Auth ha sido configurado con éxito.
          En la siguiente fase se conectará la vista interactiva con el componente ClueTree para
          la revisión y aprobación de las efemérides en estado DRAFT.
        </p>
      </div>
    </div>
  )
}
