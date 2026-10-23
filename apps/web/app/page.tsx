import { InteractiveTreeDemo } from './InteractiveTreeDemo'
import styles from './page.module.css'

export default function HomePage() {
  return (
    <main id="main-content" className={styles.main}>
      <div className={styles.contentWrapper}>
        <InteractiveTreeDemo />
      </div>
    </main>
  )
}
