#!/usr/bin/env python3

import pandas as pd
import numpy as np
import os
from pathlib import Path

def load_performance_data():
    """Load the performance statistics CSV file."""
    try:
        stats_df = pd.read_csv('csv_output/performance_statistics.csv')
        return stats_df
    except FileNotFoundError:
        print("Error: csv_output/performance_statistics.csv not found. Please run graphs.py first.")
        return None

def weis_to_gweis(weis):
    """Convert weis to Gweis (1 Gwei = 10^9 wei)."""
    return weis / 1e9

def format_number(value, decimals=2):
    """Format number to specified decimal places."""
    if pd.isna(value) or value == 0:
        return "0.00"
    return f"{value:.{decimals}f}"

def get_subcategory_display_name(subcategory):
    """Convert subcategory names to display names."""
    name_mapping = {
        'consensys': 'Consensys',
        'distordedBalances': 'Balance',
        'frozenPartitions': 'Partición',
        'BNB': 'BNB',
        'OpenZeppelin': 'OpenZeppelin',
        'USDT': 'USDT',
        'Oracle': 'Oracle',
        'TREX': 'TREX',
        'Validator': 'Validator'
    }
    return name_mapping.get(subcategory, subcategory)

def get_network_display_name(network):
    """Convert network names to display names."""
    name_mapping = {
        'hardhat': 'Hardhat',
        'sepolia': 'Sepolia',
        'holesky': 'Holesky'
    }
    return name_mapping.get(network.lower(), network.capitalize())

def generate_deployment_table(category_data, category):
    """Generate LaTeX table for deployment metrics."""
    # Filter deployment data
    deployment_data = category_data[category_data['DataType'] == 'Deployment'].copy()
    
    if deployment_data.empty:
        return ""
    
    # Get unique subcategories and networks
    subcategories = sorted(deployment_data['Subcategory'].unique())
    networks = sorted(deployment_data['Blockchain'].unique(), key=lambda x: x.lower())
    
    # Create pivot table for gas consumption (convert to Gweis)
    gas_pivot = deployment_data.pivot_table(
        index='Blockchain', 
        columns='Subcategory', 
        values='Gas_avg', 
        fill_value=0
    )
    
    # Create pivot table for fees (convert to Gweis)
    fee_pivot = deployment_data.pivot_table(
        index='Blockchain', 
        columns='Subcategory', 
        values='Fee (weis)_avg', 
        fill_value=0
    )
    fee_pivot = fee_pivot.apply(weis_to_gweis)
    
    # Create pivot table for latency
    latency_pivot = deployment_data.pivot_table(
        index='Blockchain', 
        columns='Subcategory', 
        values='Latency (ms)_avg', 
        fill_value=0
    )
    
    tables = []
    
    # Gas consumption table
    if not gas_pivot.empty:
        table_gas = f"""\\begin{{table}}[!ht]
\\centering
\\rowcolors{{1}}{{blue!20}}{{white}}
\\begin{{tabular}}{{|c|{'c|' * len(subcategories)}}}
\\rowcolor{{blue!50}}
  \\hline
  \\textbf{{Red/ERC}} & {' & '.join([f'\\textbf{{{get_subcategory_display_name(sub)}}}' for sub in subcategories])} \\\\
  \\hline
  \\hline"""
        
        for network in networks:
            if network in gas_pivot.index:
                values = []
                for sub in subcategories:
                    if sub in gas_pivot.columns:
                        value = gas_pivot.loc[network, sub]
                        values.append(format_number(value, 0))  # Gas as integer
                    else:
                        values.append("0")
                table_gas += f"\n  \\textbf{{{get_network_display_name(network)}}} & {' & '.join(values)} \\\\"
        
        table_gas += f"""
  \\hline
\\end{{tabular}}
\\caption{{Consumo de gas en despliegue de {category} (en unidades de gas)}}
\\label{{tab:{category.lower()}_gas_deployment}}
\\end{{table}}

"""
        tables.append(table_gas)
    
    # Fees table
    if not fee_pivot.empty:
        table_fees = f"""\\begin{{table}}[!ht]
\\centering
\\rowcolors{{1}}{{blue!20}}{{white}}
\\begin{{tabular}}{{|c|{'c|' * len(subcategories)}}}
\\rowcolor{{blue!50}}
  \\hline
  \\textbf{{Red/ERC}} & {' & '.join([f'\\textbf{{{get_subcategory_display_name(sub)}}}' for sub in subcategories])} \\\\
  \\hline
  \\hline"""
        
        for network in networks:
            if network in fee_pivot.index:
                values = []
                for sub in subcategories:
                    if sub in fee_pivot.columns:
                        value = fee_pivot.loc[network, sub]
                        values.append(format_number(value))
                    else:
                        values.append("0.00")
                table_fees += f"\n  \\textbf{{{get_network_display_name(network)}}} & {' & '.join(values)} \\\\"
        
        table_fees += f"""
  \\hline
\\end{{tabular}}
\\caption{{Tarifas de despliegue de {category} (en Gweis)}}
\\label{{tab:{category.lower()}_fees_deployment}}
\\end{{table}}

"""
        tables.append(table_fees)
    
    # Latency table
    if not latency_pivot.empty:
        table_latency = f"""\\begin{{table}}[!ht]
\\centering
\\rowcolors{{1}}{{blue!20}}{{white}}
\\begin{{tabular}}{{|c|{'c|' * len(subcategories)}}}
\\rowcolor{{blue!50}}
  \\hline
  \\textbf{{Red/ERC}} & {' & '.join([f'\\textbf{{{get_subcategory_display_name(sub)}}}' for sub in subcategories])} \\\\
  \\hline
  \\hline"""
        
        for network in networks:
            if network in latency_pivot.index:
                values = []
                for sub in subcategories:
                    if sub in latency_pivot.columns:
                        value = latency_pivot.loc[network, sub]
                        values.append(format_number(value))
                    else:
                        values.append("0.00")
                table_latency += f"\n  \\textbf{{{get_network_display_name(network)}}} & {' & '.join(values)} \\\\"
        
        table_latency += f"""
  \\hline
\\end{{tabular}}
\\caption{{Latencia de despliegue de {category} (en milisegundos)}}
\\label{{tab:{category.lower()}_latency_deployment}}
\\end{{table}}

"""
        tables.append(table_latency)
    
    return "\n".join(tables)

def generate_initialization_table(category_data, category):
    """Generate LaTeX table for initialization metrics."""
    # Filter initialization data
    init_data = category_data[category_data['DataType'] == 'Initialization'].copy()
    
    if init_data.empty:
        return ""
    
    # Get unique subcategories and networks
    subcategories = sorted(init_data['Subcategory'].unique())
    networks = sorted(init_data['Blockchain'].unique(), key=lambda x: x.lower())
    
    # Create pivot table for gas consumption
    gas_pivot = init_data.pivot_table(
        index='Blockchain', 
        columns='Subcategory', 
        values='Gas_avg', 
        fill_value=0
    )
    
    # Create pivot table for fees (convert to Gweis)
    fee_pivot = init_data.pivot_table(
        index='Blockchain', 
        columns='Subcategory', 
        values='Fee (weis)_avg', 
        fill_value=0
    )
    fee_pivot = fee_pivot.apply(weis_to_gweis)
    
    # Create pivot table for latency
    latency_pivot = init_data.pivot_table(
        index='Blockchain', 
        columns='Subcategory', 
        values='Latency (ms)_avg', 
        fill_value=0
    )
    
    tables = []
    
    # Gas consumption table
    if not gas_pivot.empty:
        table_gas = f"""\\begin{{table}}[!ht]
\\centering
\\rowcolors{{1}}{{blue!20}}{{white}}
\\begin{{tabular}}{{|c|{'c|' * len(subcategories)}}}
\\rowcolor{{blue!50}}
  \\hline
  \\textbf{{Red/ERC}} & {' & '.join([f'\\textbf{{{get_subcategory_display_name(sub)}}}' for sub in subcategories])} \\\\
  \\hline
  \\hline"""
        
        for network in networks:
            if network in gas_pivot.index:
                values = []
                for sub in subcategories:
                    if sub in gas_pivot.columns:
                        value = gas_pivot.loc[network, sub]
                        values.append(format_number(value, 0))  # Gas as integer
                    else:
                        values.append("0")
                table_gas += f"\n  \\textbf{{{get_network_display_name(network)}}} & {' & '.join(values)} \\\\"
        
        table_gas += f"""
  \\hline
\\end{{tabular}}
\\caption{{Consumo de gas en inicialización de {category} (en unidades de gas)}}
\\label{{tab:{category.lower()}_gas_init}}
\\end{{table}}

"""
        tables.append(table_gas)
    
    # Fees table
    if not fee_pivot.empty:
        table_fees = f"""\\begin{{table}}[!ht]
\\centering
\\rowcolors{{1}}{{blue!20}}{{white}}
\\begin{{tabular}}{{|c|{'c|' * len(subcategories)}}}
\\rowcolor{{blue!50}}
  \\hline
  \\textbf{{Red/ERC}} & {' & '.join([f'\\textbf{{{get_subcategory_display_name(sub)}}}' for sub in subcategories])} \\\\
  \\hline
  \\hline"""
        
        for network in networks:
            if network in fee_pivot.index:
                values = []
                for sub in subcategories:
                    if sub in fee_pivot.columns:
                        value = fee_pivot.loc[network, sub]
                        values.append(format_number(value))
                    else:
                        values.append("0.00")
                table_fees += f"\n  \\textbf{{{get_network_display_name(network)}}} & {' & '.join(values)} \\\\"
        
        table_fees += f"""
  \\hline
\\end{{tabular}}
\\caption{{Tarifas de inicialización de {category} (en Gweis)}}
\\label{{tab:{category.lower()}_fees_init}}
\\end{{table}}

"""
        tables.append(table_fees)
    
    # Latency table (like your example)
    if not latency_pivot.empty:
        table_latency = f"""\\begin{{table}}[!ht]
\\centering
\\rowcolors{{1}}{{blue!20}}{{white}}
\\begin{{tabular}}{{|c|{'c|' * len(subcategories)}}}
\\rowcolor{{blue!50}}
  \\hline
  \\textbf{{Red/ERC}} & {' & '.join([f'\\textbf{{{get_subcategory_display_name(sub)}}}' for sub in subcategories])} \\\\
  \\hline
  \\hline"""
        
        for network in networks:
            if network in latency_pivot.index:
                values = []
                for sub in subcategories:
                    if sub in latency_pivot.columns:
                        value = latency_pivot.loc[network, sub]
                        values.append(format_number(value))
                    else:
                        values.append("0.00")
                table_latency += f"\n  \\textbf{{{get_network_display_name(network)}}} & {' & '.join(values)} \\\\"
        
        table_latency += f"""
  \\hline
\\end{{tabular}}
\\caption{{Latencia de inicialización de {category} (en milisegundos)}}
\\label{{tab:{category.lower()}_latency_init}}
\\end{{table}}

"""
        tables.append(table_latency)
    
    return "\n".join(tables)

def generate_transaction_tables(category_data, category):
    """Generate LaTeX tables for transaction operations."""
    # Filter transaction data
    tx_data = category_data[category_data['DataType'] == 'Transaction'].copy()
    
    if tx_data.empty:
        return ""
    
    # Get unique operations, subcategories, and networks
    operations = sorted(tx_data['Operation'].unique())
    subcategories = sorted(tx_data['Subcategory'].unique())
    networks = sorted(tx_data['Blockchain'].unique(), key=lambda x: x.lower())
    
    tables = []
    
    # Create tables for each operation
    for operation in operations:
        op_data = tx_data[tx_data['Operation'] == operation].copy()
        
        if op_data.empty:
            continue
        
        # Create pivot tables
        gas_pivot = op_data.pivot_table(
            index='Blockchain', 
            columns='Subcategory', 
            values='Gas_avg', 
            fill_value=0
        )
        
        fee_pivot = op_data.pivot_table(
            index='Blockchain', 
            columns='Subcategory', 
            values='Fee (weis)_avg', 
            fill_value=0
        )
        fee_pivot = fee_pivot.apply(weis_to_gweis)
        
        latency_pivot = op_data.pivot_table(
            index='Blockchain', 
            columns='Subcategory', 
            values='Latency (ms)_avg', 
            fill_value=0
        )
        
        # Get available subcategories for this operation
        available_subcats = sorted(op_data['Subcategory'].unique())
        
        # Gas consumption table
        if not gas_pivot.empty:
            table_gas = f"""\\begin{{table}}[!ht]
\\centering
\\rowcolors{{1}}{{blue!20}}{{white}}
\\begin{{tabular}}{{|c|{'c|' * len(available_subcats)}}}
\\rowcolor{{blue!50}}
  \\hline
  \\textbf{{Red/ERC}} & {' & '.join([f'\\textbf{{{get_subcategory_display_name(sub)}}}' for sub in available_subcats])} \\\\
  \\hline
  \\hline"""
            
            for network in networks:
                if network in gas_pivot.index:
                    values = []
                    for sub in available_subcats:
                        if sub in gas_pivot.columns:
                            value = gas_pivot.loc[network, sub]
                            values.append(format_number(value, 0))
                        else:
                            values.append("0")
                    table_gas += f"\n  \\textbf{{{get_network_display_name(network)}}} & {' & '.join(values)} \\\\"
            
            operation_clean = operation.lower().replace(' ', '_')
            table_gas += f"""
  \\hline
\\end{{tabular}}
\\caption{{Consumo de gas en {operation} de {category} (en unidades de gas)}}
\\label{{tab:{category.lower()}_{operation_clean}_gas}}
\\end{{table}}

"""
            tables.append(table_gas)
        
        # Fees table
        if not fee_pivot.empty:
            table_fees = f"""\\begin{{table}}[!ht]
\\centering
\\rowcolors{{1}}{{blue!20}}{{white}}
\\begin{{tabular}}{{|c|{'c|' * len(available_subcats)}}}
\\rowcolor{{blue!50}}
  \\hline
  \\textbf{{Red/ERC}} & {' & '.join([f'\\textbf{{{get_subcategory_display_name(sub)}}}' for sub in available_subcats])} \\\\
  \\hline
  \\hline"""
            
            for network in networks:
                if network in fee_pivot.index:
                    values = []
                    for sub in available_subcats:
                        if sub in fee_pivot.columns:
                            value = fee_pivot.loc[network, sub]
                            values.append(format_number(value))
                        else:
                            values.append("0.00")
                    table_fees += f"\n  \\textbf{{{get_network_display_name(network)}}} & {' & '.join(values)} \\\\"
            
            table_fees += f"""
  \\hline
\\end{{tabular}}
\\caption{{Tarifas en {operation} de {category} (en Gweis)}}
\\label{{tab:{category.lower()}_{operation_clean}_fees}}
\\end{{table}}

"""
            tables.append(table_fees)
        
        # Latency table
        if not latency_pivot.empty:
            table_latency = f"""\\begin{{table}}[!ht]
\\centering
\\rowcolors{{1}}{{blue!20}}{{white}}
\\begin{{tabular}}{{|c|{'c|' * len(available_subcats)}}}
\\rowcolor{{blue!50}}
  \\hline
  \\textbf{{Red/ERC}} & {' & '.join([f'\\textbf{{{get_subcategory_display_name(sub)}}}' for sub in available_subcats])} \\\\
  \\hline
  \\hline"""
            
            for network in networks:
                if network in latency_pivot.index:
                    values = []
                    for sub in available_subcats:
                        if sub in latency_pivot.columns:
                            value = latency_pivot.loc[network, sub]
                            values.append(format_number(value))
                        else:
                            values.append("0.00")
                    table_latency += f"\n  \\textbf{{{get_network_display_name(network)}}} & {' & '.join(values)} \\\\"
            
            table_latency += f"""
  \\hline
\\end{{tabular}}
\\caption{{Latencia en {operation} de {category} (en milisegundos)}}
\\label{{tab:{category.lower()}_{operation_clean}_latency}}
\\end{{table}}

"""
            tables.append(table_latency)
    
    return "\n".join(tables)

def generate_latex_tables():
    """Main function to generate all LaTeX tables."""
    # Load data
    stats_df = load_performance_data()
    if stats_df is None:
        return
    
    # Create output directory
    latex_output_dir = 'latex_output'
    os.makedirs(latex_output_dir, exist_ok=True)
    
    # Create output content
    latex_content = """% LaTeX Tables for Blockchain Performance Analysis
% Generated automatically from performance statistics

% Required packages:
% \\usepackage{xcolor}
% \\usepackage{colortbl}
% \\usepackage{booktabs}

"""
    
    # Get unique categories (ERCs)
    categories = sorted(stats_df['Category'].unique())
    
    for category in categories:
        category_data = stats_df[stats_df['Category'] == category].copy()
        
        latex_content += f"""
% ===============================================
% {category} TABLES
% ===============================================

"""
        
        # Generate deployment tables
        deployment_tables = generate_deployment_table(category_data, category)
        if deployment_tables:
            latex_content += f"% {category} Deployment Tables\n"
            latex_content += deployment_tables + "\n"
        
        # Generate initialization tables
        init_tables = generate_initialization_table(category_data, category)
        if init_tables:
            latex_content += f"% {category} Initialization Tables\n"
            latex_content += init_tables + "\n"
        
        # Generate transaction tables
        tx_tables = generate_transaction_tables(category_data, category)
        if tx_tables:
            latex_content += f"% {category} Transaction Tables\n"
            latex_content += tx_tables + "\n"
    
    # Save to file
    output_file = os.path.join(latex_output_dir, 'performance_latex_tables.tex')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(latex_content)
    
    print(f"LaTeX tables generated successfully!")
    print(f"Output saved to: {output_file}")
    print(f"Tables generated for categories: {', '.join(categories)}")

if __name__ == "__main__":
    generate_latex_tables()
