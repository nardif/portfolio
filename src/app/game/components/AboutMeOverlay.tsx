import AnimatedLightWaveText, { getGridLineYs } from './AnimatedLightWaveText';

const aboutMeTexts = [
	"Hello! I'm Florencia :)",
	'Full-Stack Developer',
	'I love creating interactive experiences',
	'Welcome to my portfolio!',
];

type Props = { spriteX: number };

export default function AboutMeOverlay({ spriteX }: Props) {
	const screenH = window.innerHeight;
	const gridYs = getGridLineYs(screenH, 13); // 13 líneas, m de -6 a 6
	// Elige los índices de m que quieras (por ejemplo, m = -4, -1, 2, 4)
	const indices = [4, 5, 8, 4]; // m = -4, -1, 2, 4 (índice = m + 6)
	return (
		<>
			{aboutMeTexts.map((text, i) => (
				<AnimatedLightWaveText
					key={i}
					spriteY={gridYs[indices[i]]}
					spriteX={spriteX}
					text={text}
					duration={4000}
					delay={i * 2000}
				/>
			))}
		</>
	);
}
