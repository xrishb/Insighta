"""
InsightsEngine: Core module for generating business intelligence insights using LLMs (not tied to business only insights)
"""
import os
import pandas as pd
import json
import numpy as np
import logging
import google.generativeai as genai
from google.generativeai import GenerativeModel

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class InsightsEngine:
    """
    Main class that uses Gemini API to analyze data and generate business insights.
    """
    def __init__(self):
        """Initialize the insights engine and set up the Gemini API connection"""
        self.setup_gemini_api()
        self.model = self.get_gemini_model()
        
    def setup_gemini_api(self):
        """Configure the Gemini API with the API key"""
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            logger.warning("GEMINI_API_KEY environment variable not set. Using mock responses.")
            self.use_mock = True
        else:
            genai.configure(api_key=api_key)
            self.use_mock = False
            
    def get_gemini_model(self):
        """Initialize and return the Gemini model"""
        if self.use_mock:
            return None
        return GenerativeModel(model_name="gemini-2.0-flash")
    
    def load_data(self, file_path):
        """
        Load data from file path
        
        Args:
            file_path (str): Path to the data file
            
        Returns:
            data: Loaded data (DataFrame or dict)
        """
        ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if ext == '.csv':
                try:
                    # First try with default settings
                    return pd.read_csv(file_path)
                except Exception as e:
                    # If that fails, try with some common encoding and delimiter variations
                    logger.warning(f"Standard CSV parsing failed: {str(e)}. Trying with different parameters.")
                    
                    # Try different encodings
                    for encoding in ['utf-8', 'latin1', 'ISO-8859-1']:
                        try:
                            logger.info(f"Trying with encoding: {encoding}")
                            return pd.read_csv(file_path, encoding=encoding)
                        except Exception:
                            continue
                    
                    # Try different delimiters
                    for delimiter in [',', ';', '\t', '|']:
                        try:
                            logger.info(f"Trying with delimiter: {delimiter}")
                            return pd.read_csv(file_path, delimiter=delimiter)
                        except Exception:
                            continue
                    
                    # If all attempts fail, try a very flexible approach
                    logger.info("Trying with the most flexible settings")
                    return pd.read_csv(file_path, encoding='latin1', sep=None, engine='python')
            
            elif ext in ['.xlsx', '.xls']:
                return pd.read_excel(file_path)
            elif ext == '.json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                raise ValueError(f"Unsupported file format: {ext}")
        except Exception as e:
            logger.error(f"Error loading file {file_path}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise ValueError(f"Could not load the file: {str(e)}")
    
    def get_data_summary(self, file_path):
        """
        Generate a summary of the data for preview
        
        Args:
            file_path (str): Path to the data file
            
        Returns:
            dict: Summary of the data
        """
        data = self.load_data(file_path)
        
        if isinstance(data, pd.DataFrame):
            # For DataFrame
            summary = {
                'type': 'dataframe',
                'rows': data.shape[0],
                'columns': data.shape[1],
                'column_names': data.columns.tolist(),
                'sample': data.head(5).to_dict(orient='records'),
                'data_types': {col: str(dtype) for col, dtype in data.dtypes.items()}
            }
            
            # Add basic statistics if numerical columns exist
            numeric_cols = data.select_dtypes(include=['number']).columns.tolist()
            if numeric_cols:
                summary['statistics'] = {}
                for col in numeric_cols[:5]:  # Limit to first 5 numerical columns
                    summary['statistics'][col] = {
                        'min': float(data[col].min()) if not pd.isna(data[col].min()) else None,
                        'max': float(data[col].max()) if not pd.isna(data[col].max()) else None,
                        'mean': float(data[col].mean()) if not pd.isna(data[col].mean()) else None,
                        'median': float(data[col].median()) if not pd.isna(data[col].median()) else None
                    }
        else:
            # For JSON
            summary = {
                'type': 'json',
                'preview': json.dumps(data, indent=2)[:1000] + "..." if len(json.dumps(data)) > 1000 else json.dumps(data, indent=2)
            }
            
        return summary
    
    def generate_insights(self, file_path, question=None, insight_type="general"):
        """
        Generate insights from data using Gemini API
        
        Args:
            file_path (str): Path to the data file
            question (str, optional): Specific question to answer about the data
            insight_type (str): Type of insights to generate (general, trends, anomalies)
            
        Returns:
            str: Generated insights
        """
        data = self.load_data(file_path)
        
        # If using mock responses, return mock data
        if self.use_mock:
            return self._get_mock_insights(data, question, insight_type)
        
        # Prepare data summary for the model
        if isinstance(data, pd.DataFrame):
            data_summary = f"DataFrame with {data.shape[0]} rows and {data.shape[1]} columns.\n"
            data_summary += f"Columns: {', '.join(data.columns)}\n"
            data_summary += f"Sample data:\n{data.head(5).to_string()}\n"
            data_summary += f"Summary statistics:\n{data.describe().to_string()}"
        else:
            data_summary = f"JSON data: {json.dumps(data, indent=2)[:1000]}..."
        
        # Craft different prompts based on insight type
        if question:
            prompt = f"""
            As a business intelligence expert, analyze this data and answer the specific question:
            {question}
            
            Data:
            {data_summary}
            
            Provide a clear, concise answer with specific insights backed by the data.
            Format your response in structured paragraphs with headers for each key point.
            """
        elif insight_type == "trends":
            prompt = f"""
            As a business intelligence expert, analyze this data and identify the most significant trends.
            
            Data:
            {data_summary}
            
            Provide 3-5 key trends with supporting evidence from the data.
            Format your response with clear headers for each trend and supporting points in paragraphs.
            """
        elif insight_type == "anomalies":
            prompt = f"""
            As a business intelligence expert, analyze this data and identify any anomalies or outliers.
            
            Data:
            {data_summary}
            
            Provide details on the most significant anomalies and what they might indicate.
            Format your response with clear headers for each anomaly and supporting points in paragraphs.
            """
        else:  # general insights
            prompt = f"""
            As a business intelligence expert, analyze this data and provide valuable business insights.
            
            Data:
            {data_summary}
            
            Provide 3-5 actionable insights that could help business decision-making.
            Include specific details from the data to support each insight.
            Format your response with clear headers for each insight and supporting points in paragraphs.
            """
        
        # Generate response from Gemini
        response = self.model.generate_content(prompt)
        return response.text
    
    def generate_visualization_data(self, file_path):
        """
        Generate data for visualizations based on the input data
        
        Args:
            file_path (str): Path to the data file
            
        Returns:
            list: List of visualization data objects
        """
        data = self.load_data(file_path)
        visualizations = []
        
        if isinstance(data, pd.DataFrame):
            # Only generate visualizations for DataFrames
            
            # 1. For numeric columns, create data for bar charts or line charts
            numeric_cols = data.select_dtypes(include=['number']).columns.tolist()
            if len(numeric_cols) >= 2:
                # Correlation data
                corr_data = data[numeric_cols].corr().reset_index().melt(id_vars='index')
                corr_data.columns = ['x', 'y', 'value']
                visualizations.append({
                    'type': 'heatmap',
                    'title': 'Correlation Matrix',
                    'data': corr_data.to_dict(orient='records'),
                    'x_field': 'x',
                    'y_field': 'y',
                    'value_field': 'value'
                })
            
            # 2. Distribution data for the first few numeric columns
            for col in numeric_cols[:3]:
                # Calculate histogram data
                hist_data, bin_edges = np.histogram(data[col].dropna(), bins=10)
                viz_data = [{'bin': f"{bin_edges[i]:.2f}-{bin_edges[i+1]:.2f}", 'count': int(hist_data[i])} 
                           for i in range(len(hist_data))]
                
                visualizations.append({
                    'type': 'histogram',
                    'title': f'Distribution of {col}',
                    'data': viz_data,
                    'x_field': 'bin',
                    'y_field': 'count'
                })
            
            # 3. If we have categorical columns, create data for pie charts
            categorical_cols = data.select_dtypes(include=['object']).columns.tolist()
            for col in categorical_cols[:2]:  # Limit to first 2 categorical columns
                try:
                    # Get value counts and convert to chart data
                    value_counts = data[col].value_counts().reset_index()
                    value_counts.columns = ['category', 'count']
                    # Limit to top 10 categories
                    value_counts = value_counts.head(10)
                    
                    visualizations.append({
                        'type': 'pie',
                        'title': f'Distribution of {col}',
                        'data': value_counts.to_dict(orient='records'),
                        'category_field': 'category',
                        'value_field': 'count'
                    })
                except:
                    # Skip this column if there's an error
                    continue
                    
        return visualizations
    
    def _get_mock_insights(self, data, question, insight_type):
        """Generate mock insights when API key is not available"""
        if isinstance(data, pd.DataFrame):
            cols = data.columns.tolist()
            sample = data.head(3)
            
            if question:
                return f"""
                # Analysis of Your Question: "{question}"
                
                Based on the data provided, I can offer the following insights:
                
                ## Key Finding 1
                The data shows interesting patterns related to {cols[0]} and {cols[1]}. 
                Looking at the first few rows, we can see values like {sample[cols[0]].iloc[0]} and {sample[cols[1]].iloc[0]}.
                
                ## Key Finding 2
                There appears to be a relationship between various factors in your dataset.
                Further analysis would be needed to establish causation.
                
                ## Recommendation
                Consider exploring the relationship between {cols[0]} and other variables in more depth.
                """
            
            elif insight_type == "trends":
                return f"""
                # Key Trends Analysis
                
                ## Trend 1: {cols[0]} Growth Pattern
                The data suggests an interesting development in {cols[0]} values.
                
                ## Trend 2: Relationship Between {cols[0]} and {cols[1]}
                There appears to be a correlation worth investigating further.
                
                ## Trend 3: Seasonal Variations
                The data hints at periodic patterns that may be worth examining.
                """
                
            elif insight_type == "anomalies":
                return f"""
                # Anomaly Detection Results
                
                ## Outlier 1: Unusual {cols[0]} Values
                Some entries show values that deviate significantly from the norm.
                
                ## Anomaly 2: Unexpected Correlations
                There are surprising relationships between certain variables.
                
                ## Data Quality Issue
                Some entries may require validation or cleaning for more accurate analysis.
                """
                
            else:  # general insights
                return f"""
                # General Business Insights
                
                ## Key Insight 1: Performance Metrics
                The data indicates several important patterns in your business metrics.
                
                ## Key Insight 2: Opportunity Areas
                Based on {cols[0]} and {cols[1]}, there are potential opportunities for improvement.
                
                ## Key Insight 3: Risk Factors
                The analysis highlights some potential concerns that warrant attention.
                
                ## Key Insight 4: Competitive Positioning
                Your data suggests certain strategic advantages in the market.
                """
        else:
            # For JSON data
            return """
            # Data Analysis Results
            
            ## Overview
            The JSON data structure contains valuable information that can inform business decisions.
            
            ## Key Patterns
            Several recurring patterns emerge from the complex data structure.
            
            ## Recommendations
            Consider restructuring certain elements of your data for more efficient analysis.
            
            ## Next Steps
            A deeper dive into specific objects and arrays within the JSON would yield more specific insights.
            """ 