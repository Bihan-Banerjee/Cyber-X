import numpy as np
import matplotlib.pyplot as plt
from typing import List, Dict
import json
import requests
from datetime import datetime, timedelta


def query_elasticsearch_metrics(
    es_url: str,
    index_pattern: str = "honeypot-*",
    time_range: str = "now-1h"
) -> Dict:
    """Query Elasticsearch for honeypot metrics"""
    try:
        response = requests.post(
            f"{es_url}/{index_pattern}/_search",
            json={
                "size": 0,
                "query": {
                    "range": {"@timestamp": {"gte": time_range}}
                },
                "aggs": {
                    "event_types": {
                        "terms": {"field": "eventid.keyword", "size": 20}
                    },
                    "unique_ips": {
                        "cardinality": {"field": "src_ip.keyword"}
                    },
                    "countries": {
                        "terms": {"field": "geoip.country_name.keyword", "size": 10}
                    }
                }
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                'total_events': data['hits']['total']['value'],
                'event_types': data['aggregations']['event_types']['buckets'],
                'unique_ips': data['aggregations']['unique_ips']['value'],
                'top_countries': data['aggregations']['countries']['buckets']
            }
    except Exception as e:
        print(f"Error querying Elasticsearch: {e}")
    
    return {}


def plot_episode_metrics(episode_data: List[Dict], save_path: str = None):
    """Plot metrics from an episode"""
    steps = [d['step'] for d in episode_data]
    rewards = [d['reward'] for d in episode_data]
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
    
    # Rewards over time
    ax1.plot(steps, rewards, 'b-', linewidth=2)
    ax1.set_xlabel('Step')
    ax1.set_ylabel('Reward')
    ax1.set_title('Rewards per Step')
    ax1.grid(True, alpha=0.3)
    
    # Cumulative reward
    cumulative_rewards = np.cumsum(rewards)
    ax2.plot(steps, cumulative_rewards, 'r-', linewidth=2)
    ax2.set_xlabel('Step')
    ax2.set_ylabel('Cumulative Reward')
    ax2.set_title('Cumulative Rewards')
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
    else:
        plt.show()
    
    plt.close()


def calculate_attack_metrics(events: List[Dict]) -> Dict:
    """Calculate attack statistics from event logs"""
    metrics = {
        'total_events': len(events),
        'failed_logins': 0,
        'successful_logins': 0,
        'commands_executed': 0,
        'files_accessed': 0,
        'unique_sessions': set(),
        'unique_ips': set()
    }
    
    for event in events:
        eventid = event.get('eventid', '')
        
        if 'login.failed' in eventid:
            metrics['failed_logins'] += 1
        elif 'login.success' in eventid:
            metrics['successful_logins'] += 1
        elif 'command.input' in eventid:
            metrics['commands_executed'] += 1
        elif 'file_download' in eventid:
            metrics['files_accessed'] += 1
        
        if 'session' in event:
            metrics['unique_sessions'].add(event['session'])
        if 'src_ip' in event:
            metrics['unique_ips'].add(event['src_ip'])
    
    metrics['unique_sessions'] = len(metrics['unique_sessions'])
    metrics['unique_ips'] = len(metrics['unique_ips'])
    
    return metrics


def save_episode_replay(episode_data: List[Dict], filepath: str):
    """Save episode data for replay/analysis"""
    with open(filepath, 'w') as f:
        json.dump(episode_data, f, indent=2)
    print(f"Episode replay saved to {filepath}")


def load_episode_replay(filepath: str) -> List[Dict]:
    """Load saved episode data"""
    with open(filepath, 'r') as f:
        return json.load(f)
