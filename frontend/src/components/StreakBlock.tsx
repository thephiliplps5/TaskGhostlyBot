import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';

export function StreakBlock() {
  const { user } = useStore();

  if (!user) return null;

  const streak = user.streak || 0;
  const isZero = streak === 0;

  return (
    <motion.div 
      className="streak-block"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="flame-wrap">
        <motion.div 
          className={`flame-icon ${isZero ? 'zero' : ''}`}
          animate={isZero ? {} : {
            scale: [1, 1.08, 1],
            rotate: [-2, 3, -2],
            filter: [
              'drop-shadow(0 0 16px rgba(255,107,0,0.5))',
              'drop-shadow(0 0 24px rgba(255,140,0,0.8))',
              'drop-shadow(0 0 16px rgba(255,107,0,0.5))'
            ]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Custom Tier-1 Flame SVG */}
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="flameGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFD60A" />
                <stop offset="50%" stopColor="#FF8C00" />
                <stop offset="100%" stopColor="#FF453A" />
              </linearGradient>
            </defs>
            <path 
              d="M12 2C12 2 6 7.5 6 13C6 16.3137 8.68629 19 12 19C15.3137 19 18 16.3137 18 13C18 7.5 12 2 12 2Z" 
              fill={isZero ? '#3A3A3C' : 'url(#flameGrad)'}
            />
            <path 
              d="M12 10C12 10 10 12.5 10 15C10 16.1046 10.8954 17 12 17C13.1046 17 14 16.1046 14 15C14 12.5 12 10 12 10Z" 
              fill={isZero ? '#4A4A4C' : '#FFF700'} 
              opacity="0.8"
            />
          </svg>
        </motion.div>
        
        <motion.span 
          key={streak}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="streak-number"
        >
          {streak}
        </motion.span>
      </div>
      <span className="streak-label">Дней подряд</span>
    </motion.div>
  );
}
