import json
import os
from typing import Dict, Any

class RLConfig:
    """Centralized configuration management"""
    
    def __init__(self, config_path: str = 'config.json'):
        self.config_path = config_path
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                return json.load(f)
        else:
            print(f"⚠️  Config file not found: {self.config_path}")
            print("Using default configuration...")
            return self._default_config()
    
    def _default_config(self) -> Dict[str, Any]:
        """Default configuration if file missing"""
        return {
            "model_paths": {
                "attacker_best": "./models/production/attacker_best.zip",
                "defender_best": "./models/production/defender_best.zip"
            },
            "llm": {"enabled": False}
        }
    
    def save_config(self):
        """Save current config to file"""
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
        print(f"💾 Configuration saved to {self.config_path}")
    
    def get_best_attacker_path(self) -> str:
        return self.config['model_paths']['attacker_best']
    
    def get_best_defender_path(self) -> str:
        return self.config['model_paths']['defender_best']
    
    def update_best_models(self, iteration: int):
        """Update config to point to new best models"""
        prod_dir = self.config['model_paths']['production_dir']
        self.config['model_paths']['attacker_best'] = f"{prod_dir}/attacker_iter_{iteration}.zip"
        self.config['model_paths']['defender_best'] = f"{prod_dir}/defender_iter_{iteration}.zip"
        self.save_config()
        print(f"✅ Best models updated to iteration {iteration}")
    
    def get_llm_config(self) -> Dict[str, Any]:
        return self.config.get('llm', {'enabled': False})

# Global config instance
config = RLConfig()
