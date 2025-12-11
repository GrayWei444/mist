import { WeatherWidget } from '../components/WeatherWidget/WeatherWidget';

interface WeatherAppProps {
  onEnterChat: () => void;
  onEnterDevTools?: () => void;
}

export function WeatherApp({ onEnterChat, onEnterDevTools }: WeatherAppProps) {
  return <WeatherWidget onSecretEntry={onEnterChat} onDevTools={onEnterDevTools} />;
}
