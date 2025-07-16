#! /usr/bin/python3

import os
import pandas as pd
import numpy as np
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns
import json

def find_data_files(base_path):
    """Find all results.csv and deployment-addresses.json files in the directory structure."""
    data_files = {'csv': [], 'json': []}
    for root, dirs, files in os.walk(base_path):
        if 'results.csv' in files:
            data_files['csv'].append(os.path.join(root, 'results.csv'))
        if 'deployment-addresses.json' in files:
            data_files['json'].append(os.path.join(root, 'deployment-addresses.json'))
    return data_files

def extract_directory_info(file_path):
    """Extract directory information from file path."""
    path_parts = Path(file_path).parts
    # Find the parts after 'PERFORMANCE'
    perf_index = path_parts.index('PERFORMANCE')
    if perf_index + 2 < len(path_parts):
        category = path_parts[perf_index + 1]  # e.g., ERC1400, ERC20, ERC3643
        subcategory = path_parts[perf_index + 2]  # e.g., consensys, BNB, Oracle
        return category, subcategory
    return None, None

def load_and_process_data(data_files):
    """Load all CSV and JSON files and add directory information."""
    all_data = []
    
    # Process CSV files
    for csv_file in data_files['csv']:
        try:
            # Read CSV file
            df = pd.read_csv(csv_file)
            
            # Clean column names (remove extra spaces)
            df.columns = df.columns.str.strip()
            
            # Clean blockchain column values (remove extra spaces)
            if 'Blockchain' in df.columns:
                df['Blockchain'] = df['Blockchain'].str.strip()
            
            # Extract directory information
            category, subcategory = extract_directory_info(csv_file)
            
            # Add directory information
            df['Category'] = category
            df['Subcategory'] = subcategory
            df['Source'] = f"{category}/{subcategory}"
            df['DataType'] = 'Transaction'
            
            all_data.append(df)
            print(f"Loaded {len(df)} transaction records from {csv_file}")
            
        except Exception as e:
            print(f"Error loading {csv_file}: {e}")
    
    # Process JSON files
    for json_file in data_files['json']:
        try:
            with open(json_file, 'r') as f:
                data = json.load(f)
            
            # Extract directory information
            category, subcategory = extract_directory_info(json_file)
            
            # Process each network in the JSON file
            for network_name, network_data in data.items():
                # Skip if network_data is not a dictionary
                if not isinstance(network_data, dict):
                    continue
                
                # Extract deployment metrics from JSON
                if 'deployment' in network_data and 'metrics' in network_data['deployment']:
                    metrics = network_data['deployment']['metrics']
                    
                    # Create a dataframe row from deployment metrics
                    row_data = {
                        'Operation': 'Deployment',
                        'Gas': int(metrics.get('deploymentGas', 0)),
                        'Fee (weis)': int(metrics.get('deploymentFee', 0)),
                        'Latency (ms)': float(metrics.get('deploymentLatency', 0)),
                        'Blockchain': network_name.capitalize()  # Use actual network name
                    }
                    
                    # Add directory information
                    row_data['Category'] = category
                    row_data['Subcategory'] = subcategory
                    row_data['Source'] = f"{category}/{subcategory}"
                    row_data['DataType'] = 'Deployment'
                    
                    # Create DataFrame with single row
                    df = pd.DataFrame([row_data])
                    all_data.append(df)
                    print(f"Loaded 1 deployment record from {json_file} (network: {network_name})")
                
                # Extract initialization metrics from JSON if available
                if 'initialization' in network_data and 'metrics' in network_data['initialization']:
                    init_metrics = network_data['initialization']['metrics']
                    
                    # Create a dataframe row from initialization metrics
                    init_row_data = {
                        'Operation': 'Initialization',
                        'Gas': int(init_metrics.get('initializationGas', 0)),
                        'Fee (weis)': int(init_metrics.get('initializationFee', 0)),
                        'Latency (ms)': float(init_metrics.get('initializationLatency', 0)),
                        'Blockchain': network_name.capitalize()  # Use actual network name
                    }
                    
                    # Add directory information
                    init_row_data['Category'] = category
                    init_row_data['Subcategory'] = subcategory
                    init_row_data['Source'] = f"{category}/{subcategory}"
                    init_row_data['DataType'] = 'Initialization'
                    
                    # Create DataFrame with single row
                    init_df = pd.DataFrame([init_row_data])
                    all_data.append(init_df)
                    print(f"Loaded 1 initialization record from {json_file} (network: {network_name})")
                
        except Exception as e:
            print(f"Error loading {json_file}: {e}")
    
    # Combine all data
    if all_data:
        combined_df = pd.concat(all_data, ignore_index=True)
        return combined_df
    else:
        return pd.DataFrame()

def compute_statistics(df):
    """Compute average, max, and min for each metric by operation, blockchain, and source."""
    
    # Group by Operation, Blockchain, Category, Subcategory, and DataType
    grouped = df.groupby(['Operation', 'Blockchain', 'Category', 'Subcategory', 'DataType'])
    
    # Define the metrics to analyze
    metrics = ['Gas', 'Fee (weis)', 'Latency (ms)']
    
    results = []
    
    for (operation, blockchain, category, subcategory, data_type), group in grouped:
        result = {
            'Operation': operation,
            'Blockchain': blockchain,
            'Category': category,
            'Subcategory': subcategory,
            'DataType': data_type,
            'Source': f"{category}/{subcategory}",
            'Count': len(group)
        }
        
        for metric in metrics:
            if metric in group.columns:
                values = group[metric].dropna()
                if len(values) > 0:
                    result[f'{metric}_avg'] = values.mean()
                    result[f'{metric}_max'] = values.max()
                    result[f'{metric}_min'] = values.min()
                    result[f'{metric}_std'] = values.std()
                else:
                    result[f'{metric}_avg'] = np.nan
                    result[f'{metric}_max'] = np.nan
                    result[f'{metric}_min'] = np.nan
                    result[f'{metric}_std'] = np.nan
        
        results.append(result)
    
    return pd.DataFrame(results)

def create_visualizations(df, stats_df):
    """Create various visualizations for the data in separate windows."""
    
    # Set style
    plt.style.use('seaborn-v0_8')
    
    # Create organized output directories
    graphs_dir = 'graphs'
    individual_charts_dir = 'individual_charts'
    
    os.makedirs(graphs_dir, exist_ok=True)
    os.makedirs(individual_charts_dir, exist_ok=True)
    
    # Separate data by type
    transaction_stats = stats_df[stats_df['DataType'] == 'Transaction'].copy()
    deployment_stats = stats_df[stats_df['DataType'].isin(['Deployment', 'Initialization'])].copy()
    transaction_data = df[df['DataType'] == 'Transaction'].copy()
    deployment_data = df[df['DataType'].isin(['Deployment', 'Initialization'])].copy()
    
    # Create Transaction Operations Window
    if not transaction_stats.empty:
        fig1, axes1 = plt.subplots(2, 3, figsize=(20, 12))
        fig1.suptitle('Transaction Operations Performance Analysis', fontsize=16, fontweight='bold')
        
        # 1. Gas consumption for transactions
        ax1 = axes1[0, 0]
        gas_pivot = transaction_stats.pivot_table(
            index='Source', 
            columns=['Operation', 'Blockchain'], 
            values='Gas_avg', 
            fill_value=0
        )
        gas_pivot.plot(kind='bar', ax=ax1, rot=90)
        ax1.set_title('Average Gas Consumption by Source & Operation')
        ax1.set_ylabel('Average Gas Units')
        ax1.legend(title='Operation/Blockchain', bbox_to_anchor=(1.05, 1), loc='upper left')
        
        # Save individual chart
        fig_single = plt.figure(figsize=(12, 8))
        ax_single = fig_single.add_subplot(111)
        gas_pivot.plot(kind='bar', ax=ax_single, rot=90)
        ax_single.set_title('Average Gas Consumption by Source & Operation', fontsize=14, fontweight='bold')
        ax_single.set_ylabel('Average Gas Units')
        ax_single.legend(title='Operation/Blockchain', bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout()
        fig_single.savefig(f'{individual_charts_dir}/tx_01_gas_consumption.pdf', format='pdf', bbox_inches='tight')
        fig_single.savefig(f'{individual_charts_dir}/tx_01_gas_consumption.png', dpi=300, bbox_inches='tight')
        plt.close(fig_single)
        
        # 2. Latency for transactions
        ax2 = axes1[0, 1]
        latency_pivot = transaction_stats.pivot_table(
            index='Source', 
            columns=['Operation', 'Blockchain'], 
            values='Latency (ms)_avg', 
            fill_value=0
        )
        latency_pivot.plot(kind='bar', ax=ax2, rot=90)
        ax2.set_title('Average Latency by Source & Operation')
        ax2.set_ylabel('Average Latency (ms)')
        ax2.legend(title='Operation/Blockchain', bbox_to_anchor=(1.05, 1), loc='upper left')
        
        # Save individual chart
        fig_single = plt.figure(figsize=(12, 8))
        ax_single = fig_single.add_subplot(111)
        latency_pivot.plot(kind='bar', ax=ax_single, rot=90)
        ax_single.set_title('Average Latency by Source & Operation', fontsize=14, fontweight='bold')
        ax_single.set_ylabel('Average Latency (ms)')
        ax_single.legend(title='Operation/Blockchain', bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout()
        fig_single.savefig(f'{individual_charts_dir}/tx_02_latency_by_source.pdf', format='pdf', bbox_inches='tight')
        fig_single.savefig(f'{individual_charts_dir}/tx_02_latency_by_source.png', dpi=300, bbox_inches='tight')
        plt.close(fig_single)
        
        # 3. Fee comparison for transactions
        ax3 = axes1[0, 2]
        fee_pivot = transaction_stats.pivot_table(
            index='Source', 
            columns=['Operation', 'Blockchain'], 
            values='Fee (weis)_avg', 
            fill_value=0
        )
        fee_pivot.plot(kind='bar', ax=ax3, rot=90)
        ax3.set_title('Average Fee by Source & Operation')
        ax3.set_ylabel('Average Fee (weis)')
        ax3.legend(title='Operation/Blockchain', bbox_to_anchor=(1.05, 1), loc='upper left')
        
        # Save individual chart
        fig_single = plt.figure(figsize=(12, 8))
        ax_single = fig_single.add_subplot(111)
        fee_pivot.plot(kind='bar', ax=ax_single, rot=90)
        ax_single.set_title('Average Fee by Source & Operation', fontsize=14, fontweight='bold')
        ax_single.set_ylabel('Average Fee (weis)')
        ax_single.legend(title='Operation/Blockchain', bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout()
        fig_single.savefig(f'{individual_charts_dir}/tx_03_fees_by_source.pdf', format='pdf', bbox_inches='tight')
        fig_single.savefig(f'{individual_charts_dir}/tx_03_fees_by_source.png', dpi=300, bbox_inches='tight')
        plt.close(fig_single)
        
        # 4. Latency by network for transactions
        ax4 = axes1[1, 0]
        if not transaction_stats.empty:
            # Group by network (blockchain) and operation type
            tx_network_perf = transaction_stats.groupby(['Blockchain', 'Operation']).agg({
                'Gas_avg': 'mean',
                'Fee (weis)_avg': 'mean',
                'Latency (ms)_avg': 'mean',
                'Count': 'sum'
            }).reset_index()
            
            if not tx_network_perf.empty:
                # Create a pivot table for latency
                latency_by_network = tx_network_perf.pivot_table(
                    index='Blockchain', 
                    columns='Operation', 
                    values='Latency (ms)_avg', 
                    fill_value=0
                )
                
                # Create grouped bar chart
                latency_by_network.plot(kind='bar', ax=ax4, width=0.8)
                ax4.set_title('Transaction Latency by Network and Operation')
                ax4.set_xlabel('Network')
                ax4.set_ylabel('Average Latency (ms)')
                ax4.legend(title='Operation Type', loc='upper left')
                ax4.tick_params(axis='x', rotation=45)
                
                # Add value labels on bars for better readability
                for container in ax4.containers:
                    ax4.bar_label(container, fmt='%.0f', fontsize=8, rotation=0)
                
                # Save individual chart
                fig_single = plt.figure(figsize=(12, 8))
                ax_single = fig_single.add_subplot(111)
                latency_by_network.plot(kind='bar', ax=ax_single, width=0.8)
                ax_single.set_title('Transaction Latency by Network and Operation', fontsize=14, fontweight='bold')
                ax_single.set_xlabel('Network')
                ax_single.set_ylabel('Average Latency (ms)')
                ax_single.legend(title='Operation Type', loc='upper left')
                ax_single.tick_params(axis='x', rotation=45)
                for container in ax_single.containers:
                    ax_single.bar_label(container, fmt='%.0f', fontsize=8, rotation=0)
                plt.tight_layout()
                fig_single.savefig(f'{individual_charts_dir}/tx_04_latency_by_network.pdf', format='pdf', bbox_inches='tight')
                fig_single.savefig(f'{individual_charts_dir}/tx_04_latency_by_network.png', dpi=300, bbox_inches='tight')
                plt.close(fig_single)
            else:
                ax4.text(0.5, 0.5, 'No network data available', 
                        ha='center', va='center', transform=ax4.transAxes)
                ax4.set_title('Transaction Latency by Network and Operation')
        
        # 5. Latency distribution box plot
        ax5 = axes1[1, 1]
        if not transaction_data.empty:
            transaction_data['Op_Blockchain'] = transaction_data['Operation'] + ' (' + transaction_data['Blockchain'] + ')'
            unique_combinations = transaction_data['Op_Blockchain'].unique()
            
            if len(unique_combinations) <= 10:
                sns.boxplot(data=transaction_data, x='Op_Blockchain', y='Latency (ms)', ax=ax5)
                ax5.set_title('Transaction Latency Distribution')
                ax5.set_xticklabels(ax5.get_xticklabels(), rotation=45)
                
                # Save individual chart
                fig_single = plt.figure(figsize=(12, 8))
                ax_single = fig_single.add_subplot(111)
                sns.boxplot(data=transaction_data, x='Op_Blockchain', y='Latency (ms)', ax=ax_single)
                ax_single.set_title('Transaction Latency Distribution', fontsize=14, fontweight='bold')
                ax_single.set_xticklabels(ax_single.get_xticklabels(), rotation=45)
                plt.tight_layout()
                fig_single.savefig(f'{individual_charts_dir}/tx_05_latency_distribution.pdf', format='pdf', bbox_inches='tight')
                fig_single.savefig(f'{individual_charts_dir}/tx_05_latency_distribution.png', dpi=300, bbox_inches='tight')
                plt.close(fig_single)
            else:
                ax5.text(0.5, 0.5, 'Too many combinations\nfor box plot', 
                        ha='center', va='center', transform=ax5.transAxes)
                ax5.set_title('Transaction Latency Distribution (Data too complex)')
        
        # 6. Fees by network for transactions
        ax6 = axes1[1, 2]
        if not transaction_stats.empty:
            # Group by network (blockchain) and operation type
            tx_network_perf = transaction_stats.groupby(['Blockchain', 'Operation']).agg({
                'Gas_avg': 'mean',
                'Fee (weis)_avg': 'mean',
                'Latency (ms)_avg': 'mean',
                'Count': 'sum'
            }).reset_index()
            
            if not tx_network_perf.empty:
                # Create a pivot table for fees
                fees_by_network = tx_network_perf.pivot_table(
                    index='Blockchain', 
                    columns='Operation', 
                    values='Fee (weis)_avg', 
                    fill_value=0
                )
                
                # Check for extreme outliers that might skew the visualization
                max_fee = fees_by_network.values.max()
                if max_fee > 1e12:  # If fees are extremely large (> 1 trillion)
                    # Use log scale for better visualization
                    fees_by_network.plot(kind='bar', ax=ax6, width=0.8, logy=True)
                    ax6.set_title('Transaction Fees by Network and Operation (Log Scale)')
                    ax6.set_ylabel('Average Fee (weis) - Log Scale')
                else:
                    fees_by_network.plot(kind='bar', ax=ax6, width=0.8)
                    ax6.set_title('Transaction Fees by Network and Operation')
                    ax6.set_ylabel('Average Fee (weis)')
                
                ax6.set_xlabel('Network')
                ax6.legend(title='Operation Type', loc='upper left')
                ax6.tick_params(axis='x', rotation=45)
                
                # Add grid for better readability
                ax6.grid(True, alpha=0.3, axis='y')
                
                # Save individual chart
                fig_single = plt.figure(figsize=(12, 8))
                ax_single = fig_single.add_subplot(111)
                
                # Check for extreme outliers that might skew the visualization
                max_fee = fees_by_network.values.max()
                if max_fee > 1e12:  # If fees are extremely large (> 1 trillion)
                    fees_by_network.plot(kind='bar', ax=ax_single, width=0.8, logy=True)
                    ax_single.set_title('Transaction Fees by Network and Operation (Log Scale)', fontsize=14, fontweight='bold')
                    ax_single.set_ylabel('Average Fee (weis) - Log Scale')
                else:
                    fees_by_network.plot(kind='bar', ax=ax_single, width=0.8)
                    ax_single.set_title('Transaction Fees by Network and Operation', fontsize=14, fontweight='bold')
                    ax_single.set_ylabel('Average Fee (weis)')
                
                ax_single.set_xlabel('Network')
                ax_single.legend(title='Operation Type', loc='upper left')
                ax_single.tick_params(axis='x', rotation=45)
                ax_single.grid(True, alpha=0.3, axis='y')
                plt.tight_layout()
                fig_single.savefig(f'{individual_charts_dir}/tx_06_fees_by_network.pdf', format='pdf', bbox_inches='tight')
                fig_single.savefig(f'{individual_charts_dir}/tx_06_fees_by_network.png', dpi=300, bbox_inches='tight')
                plt.close(fig_single)
            else:
                ax6.text(0.5, 0.5, 'No network data available', 
                        ha='center', va='center', transform=ax6.transAxes)
                ax6.set_title('Transaction Fees by Network and Operation')
        
        plt.tight_layout()
        plt.savefig('graphs/transaction_performance_analysis.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    # Create Deployment Operations Window
    if not deployment_stats.empty:
        fig2, axes2 = plt.subplots(2, 3, figsize=(20, 12))
        fig2.suptitle('Deployment & Initialization Performance Analysis', fontsize=16, fontweight='bold')
        
        # 1. Deployment and initialization gas consumption
        ax1 = axes2[0, 0]
        deployment_gas = deployment_stats.pivot_table(
            index='Source', 
            columns='DataType', 
            values='Gas_avg', 
            fill_value=0
        )
        deployment_gas.plot(kind='bar', ax=ax1, rot=90)
        ax1.set_title('Average Gas Consumption by Source and Type')
        ax1.set_ylabel('Average Gas Units')
        ax1.legend(title='Operation Type')
        
        # Save individual chart
        fig_single = plt.figure(figsize=(12, 8))
        ax_single = fig_single.add_subplot(111)
        deployment_gas.plot(kind='bar', ax=ax_single, rot=90)
        ax_single.set_title('Average Gas Consumption by Source and Type', fontsize=14, fontweight='bold')
        ax_single.set_ylabel('Average Gas Units')
        ax_single.legend(title='Operation Type')
        plt.tight_layout()
        fig_single.savefig(f'{individual_charts_dir}/deploy_01_gas_consumption.pdf', format='pdf', bbox_inches='tight')
        fig_single.savefig(f'{individual_charts_dir}/deploy_01_gas_consumption.png', dpi=300, bbox_inches='tight')
        plt.close(fig_single)
        
        # 2. Deployment and initialization latency
        ax2 = axes2[0, 1]
        deployment_latency = deployment_stats.pivot_table(
            index='Source', 
            columns='DataType', 
            values='Latency (ms)_avg', 
            fill_value=0
        )
        deployment_latency.plot(kind='bar', ax=ax2, rot=90)
        ax2.set_title('Average Latency by Source and Type')
        ax2.set_ylabel('Average Latency (ms)')
        ax2.legend(title='Operation Type')
        
        # Save individual chart
        fig_single = plt.figure(figsize=(12, 8))
        ax_single = fig_single.add_subplot(111)
        deployment_latency.plot(kind='bar', ax=ax_single, rot=90)
        ax_single.set_title('Average Latency by Source and Type', fontsize=14, fontweight='bold')
        ax_single.set_ylabel('Average Latency (ms)')
        ax_single.legend(title='Operation Type')
        plt.tight_layout()
        fig_single.savefig(f'{individual_charts_dir}/deploy_02_latency_by_source.pdf', format='pdf', bbox_inches='tight')
        fig_single.savefig(f'{individual_charts_dir}/deploy_02_latency_by_source.png', dpi=300, bbox_inches='tight')
        plt.close(fig_single)
        
        # 3. Deployment and initialization fees
        ax3 = axes2[0, 2]
        deployment_fee = deployment_stats.pivot_table(
            index='Source', 
            columns='DataType', 
            values='Fee (weis)_avg', 
            fill_value=0
        )
        deployment_fee.plot(kind='bar', ax=ax3, rot=90)
        ax3.set_title('Average Fees by Source and Type')
        ax3.set_ylabel('Average Fee (weis)')
        ax3.legend(title='Operation Type')
        
        # Save individual chart
        fig_single = plt.figure(figsize=(12, 8))
        ax_single = fig_single.add_subplot(111)
        deployment_fee.plot(kind='bar', ax=ax_single, rot=90)
        ax_single.set_title('Average Fees by Source and Type', fontsize=14, fontweight='bold')
        ax_single.set_ylabel('Average Fee (weis)')
        ax_single.legend(title='Operation Type')
        plt.tight_layout()
        fig_single.savefig(f'{individual_charts_dir}/deploy_03_fees_by_source.pdf', format='pdf', bbox_inches='tight')
        fig_single.savefig(f'{individual_charts_dir}/deploy_03_fees_by_source.png', dpi=300, bbox_inches='tight')
        plt.close(fig_single)
        
        # 4. Fees by network
        ax4 = axes2[1, 0]
        if not deployment_stats.empty:
            # Group by network (blockchain) and operation type
            network_perf = deployment_stats.groupby(['Blockchain', 'DataType']).agg({
                'Gas_avg': 'mean',
                'Fee (weis)_avg': 'mean',
                'Latency (ms)_avg': 'mean',
                'Count': 'sum'
            }).reset_index()
            
            if not network_perf.empty:
                # Create a pivot table for fees
                fees_by_network = network_perf.pivot_table(
                    index='Blockchain', 
                    columns='DataType', 
                    values='Fee (weis)_avg', 
                    fill_value=0
                )
                
                # Check for extreme outliers that might skew the visualization
                max_fee = fees_by_network.values.max()
                if max_fee > 1e12:  # If fees are extremely large (> 1 trillion)
                    # Use log scale for better visualization
                    fees_by_network.plot(kind='bar', ax=ax4, width=0.8, logy=True)
                    ax4.set_title('Average Fees by Network (Log Scale)')
                    ax4.set_ylabel('Average Fee (weis) - Log Scale')
                else:
                    fees_by_network.plot(kind='bar', ax=ax4, width=0.8)
                    ax4.set_title('Average Fees by Network')
                    ax4.set_ylabel('Average Fee (weis)')
                
                ax4.set_xlabel('Network')
                ax4.legend(title='Operation Type', loc='upper left')
                ax4.tick_params(axis='x', rotation=45)
                
                # Save individual chart
                fig_single = plt.figure(figsize=(12, 8))
                ax_single = fig_single.add_subplot(111)
                
                # Check for extreme outliers that might skew the visualization
                max_fee = fees_by_network.values.max()
                if max_fee > 1e12:  # If fees are extremely large (> 1 trillion)
                    fees_by_network.plot(kind='bar', ax=ax_single, width=0.8, logy=True)
                    ax_single.set_title('Average Deployment Fees by Network (Log Scale)', fontsize=14, fontweight='bold')
                    ax_single.set_ylabel('Average Fee (weis) - Log Scale')
                else:
                    fees_by_network.plot(kind='bar', ax=ax_single, width=0.8)
                    ax_single.set_title('Average Deployment Fees by Network', fontsize=14, fontweight='bold')
                    ax_single.set_ylabel('Average Fee (weis)')
                
                ax_single.set_xlabel('Network')
                ax_single.legend(title='Operation Type', loc='upper left')
                ax_single.tick_params(axis='x', rotation=45)
                plt.tight_layout()
                fig_single.savefig(f'{individual_charts_dir}/deploy_04_fees_by_network.pdf', format='pdf', bbox_inches='tight')
                fig_single.savefig(f'{individual_charts_dir}/deploy_04_fees_by_network.png', dpi=300, bbox_inches='tight')
                plt.close(fig_single)
            else:
                ax4.text(0.5, 0.5, 'No network data available', 
                        ha='center', va='center', transform=ax4.transAxes)
                ax4.set_title('Average Fees by Network')
        
        # 5. Latency by network
        ax5 = axes2[1, 1]
        if not deployment_stats.empty:
            # Group by network (blockchain) and operation type
            network_perf = deployment_stats.groupby(['Blockchain', 'DataType']).agg({
                'Gas_avg': 'mean',
                'Fee (weis)_avg': 'mean',
                'Latency (ms)_avg': 'mean',
                'Count': 'sum'
            }).reset_index()
            
            if not network_perf.empty:
                # Create a pivot table for latency
                latency_by_network = network_perf.pivot_table(
                    index='Blockchain', 
                    columns='DataType', 
                    values='Latency (ms)_avg', 
                    fill_value=0
                )
                
                # Create grouped bar chart
                latency_by_network.plot(kind='bar', ax=ax5, width=0.8)
                ax5.set_title('Average Latency by Network')
                ax5.set_xlabel('Network')
                ax5.set_ylabel('Average Latency (ms)')
                ax5.legend(title='Operation Type', loc='upper left')
                ax5.tick_params(axis='x', rotation=45)
                
                # Add value labels on bars for better readability
                for container in ax5.containers:
                    ax5.bar_label(container, fmt='%.0f', fontsize=8, rotation=0)
                
                # Save individual chart
                fig_single = plt.figure(figsize=(12, 8))
                ax_single = fig_single.add_subplot(111)
                latency_by_network.plot(kind='bar', ax=ax_single, width=0.8)
                ax_single.set_title('Average Deployment Latency by Network', fontsize=14, fontweight='bold')
                ax_single.set_xlabel('Network')
                ax_single.set_ylabel('Average Latency (ms)')
                ax_single.legend(title='Operation Type', loc='upper left')
                ax_single.tick_params(axis='x', rotation=45)
                for container in ax_single.containers:
                    ax_single.bar_label(container, fmt='%.0f', fontsize=8, rotation=0)
                plt.tight_layout()
                fig_single.savefig(f'{individual_charts_dir}/deploy_05_latency_by_network.pdf', format='pdf', bbox_inches='tight')
                fig_single.savefig(f'{individual_charts_dir}/deploy_05_latency_by_network.png', dpi=300, bbox_inches='tight')
                plt.close(fig_single)
            else:
                ax5.text(0.5, 0.5, 'No network data available', 
                        ha='center', va='center', transform=ax5.transAxes)
                ax5.set_title('Average Latency by Network')
        
        # 6. Setup cost breakdown
        ax6 = axes2[1, 2]
        if not deployment_stats.empty:
            # Pie chart of setup costs by category and type
            category_type_costs = deployment_stats.groupby(['Category', 'DataType'])['Gas_avg'].sum()
            
            # Create labels that include both category and type
            labels = [f"{cat}\n({dtype})" for cat, dtype in category_type_costs.index]
            
            ax6.pie(category_type_costs.values, labels=labels, autopct='%1.1f%%', 
                   colors=['#ff9999', '#66b3ff', '#99ff99', '#ffcc99', '#ff99cc', '#c2c2f0'])
            ax6.set_title('Setup Cost Distribution by Category & Type\n(Sum of Average Gas Units)')
            
            # Save individual chart
            fig_single = plt.figure(figsize=(10, 10))
            ax_single = fig_single.add_subplot(111)
            ax_single.pie(category_type_costs.values, labels=labels, autopct='%1.1f%%', 
                   colors=['#ff9999', '#66b3ff', '#99ff99', '#ffcc99', '#ff99cc', '#c2c2f0'])
            ax_single.set_title('Setup Cost Distribution by Category & Type\n(Sum of Average Gas Units)', fontsize=14, fontweight='bold')
            plt.tight_layout()
            fig_single.savefig(f'{individual_charts_dir}/deploy_06_setup_cost_distribution.pdf', format='pdf', bbox_inches='tight')
            fig_single.savefig(f'{individual_charts_dir}/deploy_06_setup_cost_distribution.png', dpi=300, bbox_inches='tight')
            plt.close(fig_single)
        
        plt.tight_layout()
        plt.savefig('graphs/deployment_performance_analysis.png', dpi=300, bbox_inches='tight')
        plt.show()
    
    # Create Operation-Focused Window (NEW)
    if not transaction_stats.empty:
        # Get unique operations
        operations = sorted(transaction_stats['Operation'].unique())
        
        for operation in operations:
            # Filter data for this specific operation
            op_data = transaction_stats[transaction_stats['Operation'] == operation].copy()
            
            if op_data.empty:
                continue
            
            # Create a new window for this operation
            fig3, axes3 = plt.subplots(1, 3, figsize=(18, 6))
            fig3.suptitle(f'{operation} Operation Performance Across All ERC Implementations', fontsize=16, fontweight='bold')
            
            # 1. Gas consumption for this operation across all ERC implementations
            ax1 = axes3[0]
            gas_pivot_op = op_data.pivot_table(
                index='Source',  # Group by ERC/implementation (e.g., ERC1400/consensys)
                columns='Blockchain',  # Network
                values='Gas_avg',
                fill_value=0
            )
            
            if not gas_pivot_op.empty:
                gas_pivot_op.plot(kind='bar', ax=ax1, rot=90)
                ax1.set_title(f'Average Gas Consumption - {operation}')
                ax1.set_ylabel('Average Gas Units')
                ax1.set_xlabel('ERC/Implementation')
                ax1.legend(title='Network', bbox_to_anchor=(1.05, 1), loc='upper left')
                ax1.tick_params(axis='x', rotation=90)
            else:
                ax1.text(0.5, 0.5, 'No data available', ha='center', va='center', transform=ax1.transAxes)
                ax1.set_title(f'Average Gas Consumption - {operation}')
            
            # Save individual chart for gas
            fig_single = plt.figure(figsize=(12, 8))
            ax_single = fig_single.add_subplot(111)
            if not gas_pivot_op.empty:
                gas_pivot_op.plot(kind='bar', ax=ax_single, rot=90)
                ax_single.set_title(f'Average Gas Consumption - {operation}', fontsize=14, fontweight='bold')
                ax_single.set_ylabel('Average Gas Units')
                ax_single.set_xlabel('ERC/Implementation')
                ax_single.legend(title='Network', bbox_to_anchor=(1.05, 1), loc='upper left')
                ax_single.tick_params(axis='x', rotation=90)
            else:
                ax_single.text(0.5, 0.5, 'No data available', ha='center', va='center', transform=ax_single.transAxes)
                ax_single.set_title(f'Average Gas Consumption - {operation}')
            plt.tight_layout()
            operation_clean = operation.lower().replace(' ', '_')
            fig_single.savefig(f'{individual_charts_dir}/op_{operation_clean}_gas_all_ercs.pdf', format='pdf', bbox_inches='tight')
            fig_single.savefig(f'{individual_charts_dir}/op_{operation_clean}_gas_all_ercs.png', dpi=300, bbox_inches='tight')
            plt.close(fig_single)
            
            # 2. Latency for this operation across all ERC implementations
            ax2 = axes3[1]
            latency_pivot_op = op_data.pivot_table(
                index='Source',
                columns='Blockchain',
                values='Latency (ms)_avg',
                fill_value=0
            )
            
            if not latency_pivot_op.empty:
                latency_pivot_op.plot(kind='bar', ax=ax2, rot=90)
                ax2.set_title(f'Average Latency - {operation}')
                ax2.set_ylabel('Average Latency (ms)')
                ax2.set_xlabel('ERC/Implementation')
                ax2.legend(title='Network', bbox_to_anchor=(1.05, 1), loc='upper left')
                ax2.tick_params(axis='x', rotation=90)
            else:
                ax2.text(0.5, 0.5, 'No data available', ha='center', va='center', transform=ax2.transAxes)
                ax2.set_title(f'Average Latency - {operation}')
            
            # Save individual chart for latency
            fig_single = plt.figure(figsize=(12, 8))
            ax_single = fig_single.add_subplot(111)
            if not latency_pivot_op.empty:
                latency_pivot_op.plot(kind='bar', ax=ax_single, rot=90)
                ax_single.set_title(f'Average Latency - {operation}', fontsize=14, fontweight='bold')
                ax_single.set_ylabel('Average Latency (ms)')
                ax_single.set_xlabel('ERC/Implementation')
                ax_single.legend(title='Network', bbox_to_anchor=(1.05, 1), loc='upper left')
                ax_single.tick_params(axis='x', rotation=90)
            else:
                ax_single.text(0.5, 0.5, 'No data available', ha='center', va='center', transform=ax_single.transAxes)
                ax_single.set_title(f'Average Latency - {operation}')
            plt.tight_layout()
            fig_single.savefig(f'{individual_charts_dir}/op_{operation_clean}_latency_all_ercs.pdf', format='pdf', bbox_inches='tight')
            fig_single.savefig(f'{individual_charts_dir}/op_{operation_clean}_latency_all_ercs.png', dpi=300, bbox_inches='tight')
            plt.close(fig_single)
            
            # 3. Fees for this operation across all ERC implementations
            ax3 = axes3[2]
            fee_pivot_op = op_data.pivot_table(
                index='Source',
                columns='Blockchain',
                values='Fee (weis)_avg',
                fill_value=0
            )
            
            if not fee_pivot_op.empty:
                # Check for extreme outliers
                max_fee = fee_pivot_op.values.max()
                if max_fee > 1e12:  # If fees are extremely large (> 1 trillion)
                    fee_pivot_op.plot(kind='bar', ax=ax3, rot=90, logy=True)
                    ax3.set_title(f'Average Fees - {operation} (Log Scale)')
                    ax3.set_ylabel('Average Fee (weis) - Log Scale')
                else:
                    fee_pivot_op.plot(kind='bar', ax=ax3, rot=90)
                    ax3.set_title(f'Average Fees - {operation}')
                    ax3.set_ylabel('Average Fee (weis)')
                
                ax3.set_xlabel('ERC/Implementation')
                ax3.legend(title='Network', bbox_to_anchor=(1.05, 1), loc='upper left')
                ax3.tick_params(axis='x', rotation=90)
                ax3.grid(True, alpha=0.3, axis='y')
            else:
                ax3.text(0.5, 0.5, 'No data available', ha='center', va='center', transform=ax3.transAxes)
                ax3.set_title(f'Average Fees - {operation}')
            
            # Save individual chart for fees
            fig_single = plt.figure(figsize=(12, 8))
            ax_single = fig_single.add_subplot(111)
            if not fee_pivot_op.empty:
                max_fee = fee_pivot_op.values.max()
                if max_fee > 1e12:  # If fees are extremely large (> 1 trillion)
                    fee_pivot_op.plot(kind='bar', ax=ax_single, rot=90, logy=True)
                    ax_single.set_title(f'Average Fees - {operation} (Log Scale)', fontsize=14, fontweight='bold')
                    ax_single.set_ylabel('Average Fee (weis) - Log Scale')
                else:
                    fee_pivot_op.plot(kind='bar', ax=ax_single, rot=90)
                    ax_single.set_title(f'Average Fees - {operation}', fontsize=14, fontweight='bold')
                    ax_single.set_ylabel('Average Fee (weis)')
                
                ax_single.set_xlabel('ERC/Implementation')
                ax_single.legend(title='Network', bbox_to_anchor=(1.05, 1), loc='upper left')
                ax_single.tick_params(axis='x', rotation=90)
                ax_single.grid(True, alpha=0.3, axis='y')
            else:
                ax_single.text(0.5, 0.5, 'No data available', ha='center', va='center', transform=ax_single.transAxes)
                ax_single.set_title(f'Average Fees - {operation}')
            plt.tight_layout()
            fig_single.savefig(f'{individual_charts_dir}/op_{operation_clean}_fees_all_ercs.pdf', format='pdf', bbox_inches='tight')
            fig_single.savefig(f'{individual_charts_dir}/op_{operation_clean}_fees_all_ercs.png', dpi=300, bbox_inches='tight')
            plt.close(fig_single)
            
            plt.tight_layout()
            plt.savefig(f'graphs/{operation_clean}_operation_analysis.png', dpi=300, bbox_inches='tight')
            plt.show()
    
    # Create ERC/Implementation Comparison Window (NEW)
    if not transaction_stats.empty:
        # Get unique ERC categories (e.g., ERC1400, ERC20, ERC3643)
        erc_categories = sorted(transaction_stats['Category'].unique())
        
        # For each metric, create a window with subplots for each ERC standard
        metrics = [
            ('Gas_avg', 'Gas Consumption', 'Average Gas Units'),
            ('Latency (ms)_avg', 'Latency', 'Average Latency (ms)'),
            ('Fee (weis)_avg', 'Fees', 'Average Fee (weis)')
        ]
        
        for metric_col, metric_name, ylabel in metrics:
            # Calculate subplot layout - one subplot per ERC standard
            n_categories = len(erc_categories)
            cols = 3  # 3 columns
            rows = (n_categories + cols - 1) // cols  # Ceiling division
            
            fig4, axes4 = plt.subplots(rows, cols, figsize=(18, 6 * rows))
            fig4.suptitle(f'{metric_name} Comparison by ERC Standard', fontsize=16, fontweight='bold')
            
            # Ensure axes is always a 2D array
            if rows == 1:
                axes4 = axes4.reshape(1, -1)
            elif cols == 1:
                axes4 = axes4.reshape(-1, 1)
            
            for idx, erc_category in enumerate(erc_categories):
                row = idx // cols
                col = idx % cols
                ax = axes4[row, col]
                
                # Filter data for this specific ERC category
                erc_data = transaction_stats[transaction_stats['Category'] == erc_category].copy()
                
                if not erc_data.empty:
                    # Create pivot table for this ERC category
                    # Index: implementation names (subcategories)
                    # Columns: (Operation, Blockchain) multi-index
                    erc_pivot = erc_data.pivot_table(
                        index='Subcategory',  # Implementation names (consensys, BNB, Oracle, etc.)
                        columns=['Operation', 'Blockchain'],  # Multi-index columns
                        values=metric_col,
                        fill_value=0
                    )
                    
                    if not erc_pivot.empty:
                        # Check for extreme outliers in fees
                        if metric_col == 'Fee (weis)_avg':
                            max_fee = erc_pivot.values.max()
                            if max_fee > 1e12:  # If fees are extremely large (> 1 trillion)
                                erc_pivot.plot(kind='bar', ax=ax, rot=45, logy=True)
                                ax.set_ylabel(f'{ylabel} - Log Scale')
                            else:
                                erc_pivot.plot(kind='bar', ax=ax, rot=45)
                                ax.set_ylabel(ylabel)
                        else:
                            erc_pivot.plot(kind='bar', ax=ax, rot=45)
                            ax.set_ylabel(ylabel)
                        
                        ax.set_title(f'{erc_category}')
                        ax.set_xlabel('Implementation')
                        ax.legend(title='Operation/Network', bbox_to_anchor=(1.05, 1), loc='upper left')
                        ax.tick_params(axis='x', rotation=45)
                        
                        if metric_col == 'Fee (weis)_avg':
                            ax.grid(True, alpha=0.3, axis='y')
                    else:
                        ax.text(0.5, 0.5, 'No data available', ha='center', va='center', transform=ax.transAxes)
                        ax.set_title(f'{erc_category} - No Data')
                else:
                    ax.text(0.5, 0.5, 'No data available', ha='center', va='center', transform=ax.transAxes)
                    ax.set_title(f'{erc_category} - No Data')
            
            # Hide empty subplots
            total_subplots = rows * cols
            for idx in range(n_categories, total_subplots):
                row = idx // cols
                col = idx % cols
                axes4[row, col].set_visible(False)
            
            plt.tight_layout()
            metric_clean = metric_name.lower().replace(' ', '_')
            plt.savefig(f'graphs/{metric_clean}_by_erc_standard.png', dpi=300, bbox_inches='tight')
            plt.show()
            
            # Save individual charts for each ERC standard
            for erc_category in erc_categories:
                erc_data = transaction_stats[transaction_stats['Category'] == erc_category].copy()
                
                if not erc_data.empty:
                    erc_pivot = erc_data.pivot_table(
                        index='Subcategory',
                        columns=['Operation', 'Blockchain'],
                        values=metric_col,
                        fill_value=0
                    )
                    
                    if not erc_pivot.empty:
                        fig_single = plt.figure(figsize=(12, 8))
                        ax_single = fig_single.add_subplot(111)
                        
                        # Check for extreme outliers in fees
                        if metric_col == 'Fee (weis)_avg':
                            max_fee = erc_pivot.values.max()
                            if max_fee > 1e12:  # If fees are extremely large (> 1 trillion)
                                erc_pivot.plot(kind='bar', ax=ax_single, rot=45, logy=True)
                                ax_single.set_ylabel(f'{ylabel} - Log Scale')
                            else:
                                erc_pivot.plot(kind='bar', ax=ax_single, rot=45)
                                ax_single.set_ylabel(ylabel)
                        else:
                            erc_pivot.plot(kind='bar', ax=ax_single, rot=45)
                            ax_single.set_ylabel(ylabel)
                        
                        ax_single.set_title(f'{metric_name} - {erc_category}', fontsize=14, fontweight='bold')
                        ax_single.set_xlabel('Implementation')
                        ax_single.legend(title='Operation/Network', bbox_to_anchor=(1.05, 1), loc='upper left')
                        ax_single.tick_params(axis='x', rotation=45)
                        
                        if metric_col == 'Fee (weis)_avg':
                            ax_single.grid(True, alpha=0.3, axis='y')
                        
                        plt.tight_layout()
                        erc_clean = erc_category.lower()
                        fig_single.savefig(f'{individual_charts_dir}/erc_standard_{erc_clean}_{metric_clean}.pdf', format='pdf', bbox_inches='tight')
                        fig_single.savefig(f'{individual_charts_dir}/erc_standard_{erc_clean}_{metric_clean}.png', dpi=300, bbox_inches='tight')
                        plt.close(fig_single)

def print_summary_table(stats_df):
    """Print a formatted summary table."""
    print("\n" + "="*120)
    print("PERFORMANCE ANALYSIS SUMMARY")
    print("="*120)
    
    # Sort by category, subcategory, blockchain, and operation
    stats_df_sorted = stats_df.sort_values(['Category', 'Subcategory', 'Blockchain', 'Operation', 'DataType'])
    
    for category in stats_df_sorted['Category'].unique():
        print(f"\n{category} Performance:")
        print("-" * 60)
        
        category_data = stats_df_sorted[stats_df_sorted['Category'] == category]
        
        for subcategory in category_data['Subcategory'].unique():
            subcat_data = category_data[category_data['Subcategory'] == subcategory]
            print(f"\n  {subcategory}:")
            
            for blockchain in subcat_data['Blockchain'].unique():
                blockchain_data = subcat_data[subcat_data['Blockchain'] == blockchain]
                if len(blockchain_data) > 0:
                    print(f"    Blockchain: {blockchain}")
                    
                    for _, row in blockchain_data.iterrows():
                        data_type_info = f" [{row['DataType']}]" if 'DataType' in row else ""
                        print(f"      {row['Operation']}{data_type_info}:")
                        print(f"        Gas:     avg={row['Gas_avg']:.0f}, max={row['Gas_max']:.0f}, min={row['Gas_min']:.0f}")
                        print(f"        Fee:     avg={row['Fee (weis)_avg']:.0f}, max={row['Fee (weis)_max']:.0f}, min={row['Fee (weis)_min']:.0f}")
                        print(f"        Latency: avg={row['Latency (ms)_avg']:.2f}ms, max={row['Latency (ms)_max']:.2f}ms, min={row['Latency (ms)_min']:.2f}ms")
                        print(f"        Samples: {row['Count']}")
                        print()

def main():
    """Main function to run the analysis."""
    
    # Get the base path (current directory)
    base_path = os.path.dirname(os.path.abspath(__file__))
    
    print(f"Analyzing performance data in: {base_path}")
    
    # Create output directories early
    os.makedirs('csv_output', exist_ok=True)
    
    # Find all data files
    data_files = find_data_files(base_path)
    print(f"Found {len(data_files['csv'])} CSV files and {len(data_files['json'])} JSON files:")
    
    print("\nCSV Files:")
    for csv_file in data_files['csv']:
        print(f"  - {csv_file}")
    
    print("\nJSON Files:")
    for json_file in data_files['json']:
        print(f"  - {json_file}")
    
    if not data_files['csv'] and not data_files['json']:
        print("No data files found!")
        return
    
    # Load and process data
    print("\nLoading data...")
    df = load_and_process_data(data_files)
    
    if df.empty:
        print("No data loaded!")
        return
    
    print(f"\nTotal records loaded: {len(df)}")
    print(f"Categories found: {df['Category'].unique()}")
    print(f"Subcategories found: {df['Subcategory'].unique()}")
    print(f"Operations found: {df['Operation'].unique()}")
    print(f"Blockchains found: {df['Blockchain'].unique()}")
    if 'DataType' in df.columns:
        print(f"Data types found: {df['DataType'].unique()}")
    
    # Compute statistics
    print("\nComputing statistics...")
    stats_df = compute_statistics(df)
    
    # Save results to CSV
    stats_df.to_csv('csv_output/performance_statistics.csv', index=False)
    df.to_csv('csv_output/combined_data.csv', index=False)
    
    # Print summary
    print_summary_table(stats_df)
    
    # Create visualizations
    print("\nCreating visualizations...")
    create_visualizations(df, stats_df)
    
    print(f"\nAnalysis complete!")
    print(f"- Combined data saved to: csv_output/combined_data.csv")
    print(f"- Statistics saved to: csv_output/performance_statistics.csv")
    print(f"- Transaction visualizations saved to: graphs/transaction_performance_analysis.png")
    print(f"- Deployment & initialization visualizations saved to: graphs/deployment_performance_analysis.png")
    print(f"- Operation-focused visualizations saved to: graphs/[operation_name]_operation_analysis.png")
    print(f"- ERC/Implementation comparison visualizations saved to: graphs/[metric]_by_erc_standard.png")
    print(f"- Individual charts (PDF & PNG) saved to: individual_charts/ directory")
    print(f"  * Transaction charts: tx_01 to tx_06")
    print(f"  * Deployment charts: deploy_01 to deploy_06")
    print(f"  * Operation-focused charts: op_[operation]_[metric]_all_ercs.pdf/png")
    print(f"  * ERC Standard charts: erc_standard_[erc]_[metric].pdf/png")

if __name__ == "__main__":
    main()


