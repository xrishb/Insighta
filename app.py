import os
from flask import Flask, render_template, request, jsonify, session
from app.insights_engine import InsightsEngine
import pandas as pd
import json
import uuid
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder='app/templates', static_folder='app/static')
app.secret_key = os.environ.get('SECRET_KEY', 'insighta-dev-key')

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Sample data path
SAMPLE_DATA_PATH = os.path.join('app', 'static', 'data', 'sample_data.csv')

# Initialize insights engine
insights_engine = InsightsEngine()

@app.route('/')
def index():
    """Render the main application page"""
    return render_template('index.html')

@app.route('/sample_data', methods=['GET'])
def sample_data():
    """Load sample data for demonstration"""
    try:
        logger.info("Loading sample data for demonstration")
        
        # Ensure sample data exists
        if not os.path.exists(SAMPLE_DATA_PATH):
            # If sample data doesn't exist, create a basic sample dataset
            os.makedirs(os.path.dirname(SAMPLE_DATA_PATH), exist_ok=True)
            
            # Create a sample sales dataset
            sample_data = {
                'Date': ['2023-01-01', '2023-01-02', '2023-01-03', '2023-01-04', '2023-01-05',
                         '2023-01-06', '2023-01-07', '2023-01-08', '2023-01-09', '2023-01-10'],
                'Product': ['Laptop', 'Phone', 'Tablet', 'Laptop', 'Phone',
                            'Tablet', 'Laptop', 'Phone', 'Tablet', 'Laptop'],
                'Category': ['Electronics', 'Electronics', 'Electronics', 'Electronics', 'Electronics',
                             'Electronics', 'Electronics', 'Electronics', 'Electronics', 'Electronics'],
                'Price': [1200, 800, 600, 1300, 750, 550, 1250, 820, 580, 1350],
                'Quantity': [5, 10, 8, 3, 12, 7, 6, 9, 4, 5],
                'Revenue': [6000, 8000, 4800, 3900, 9000, 3850, 7500, 7380, 2320, 6750],
                'CustomerAge': [34, 25, 42, 29, 37, 45, 31, 28, 40, 33],
                'CustomerGender': ['M', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F'],
                'Region': ['North', 'South', 'East', 'West', 'North', 'South', 'East', 'West', 'North', 'South']
            }
            
            # Convert to DataFrame and save as CSV
            df = pd.DataFrame(sample_data)
            df.to_csv(SAMPLE_DATA_PATH, index=False)
            logger.info(f"Created sample data at {SAMPLE_DATA_PATH}")
        
        # Create a session ID and store file path
        session_id = str(uuid.uuid4())
        session['session_id'] = session_id
        session['file_path'] = SAMPLE_DATA_PATH
        session['original_filename'] = 'sample_data.csv'
        
        # Get data summary
        data_summary = insights_engine.get_data_summary(SAMPLE_DATA_PATH)
        
        return jsonify({
            'success': True,
            'filename': 'sample_data.csv (Demo)',
            'summary': data_summary
        })
        
    except Exception as e:
        logger.error(f"Error loading sample data: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Error loading sample data: {str(e)}'}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and store it for analysis"""
    try:
        if 'file' not in request.files:
            logger.error("No file part in the request")
            return jsonify({'error': 'No file part in the request'}), 400
        
        file = request.files['file']
        logger.info(f"Received file: {file.filename}, content type: {file.content_type}")
        
        if file.filename == '':
            logger.error("No selected file")
            return jsonify({'error': 'No selected file'}), 400
        
        # Check file extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in ['.csv', '.xlsx', '.xls', '.json']:
            logger.error(f"Unsupported file type: {file_ext}")
            return jsonify({'error': f'Unsupported file type: {file_ext}. Please upload CSV, Excel, or JSON files.'}), 400
        
        # Generate unique session ID for this analysis
        session_id = str(uuid.uuid4())
        session['session_id'] = session_id
        
        # Save file with session ID
        saved_filename = f"{session_id}{file_ext}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_filename)
        
        # Ensure upload directory exists
        if not os.path.exists(app.config['UPLOAD_FOLDER']):
            os.makedirs(app.config['UPLOAD_FOLDER'])
        
        file.save(file_path)
        logger.info(f"File saved to {file_path}")
        
        # Store file info in session
        session['file_path'] = file_path
        session['original_filename'] = file.filename
        
        try:
            # Get data summary for preview
            data_summary = insights_engine.get_data_summary(file_path)
            logger.info("Successfully generated data summary")
            
            # Return the response with success flag, filename and summary
            response_data = {
                'success': True,
                'filename': file.filename,
                'summary': data_summary
            }
            logger.debug(f"Response data keys: {list(response_data.keys())}")
            return jsonify(response_data)
            
        except Exception as e:
            logger.error(f"Error processing uploaded file: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return jsonify({'error': f'Error processing file: {str(e)}'}), 500
    
    except Exception as e:
        logger.error(f"Unexpected error during file upload: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/analyze', methods=['POST'])
def analyze_data():
    """Generate insights based on the uploaded data and parameters"""
    if 'file_path' not in session:
        return jsonify({'error': 'No file uploaded. Please upload a file first.'}), 400
    
    file_path = session['file_path']
    
    # Get analysis parameters
    data = request.get_json()
    insight_type = data.get('insight_type', 'general')
    question = data.get('question', None)
    
    try:
        # Generate insights
        insights = insights_engine.generate_insights(
            file_path, 
            question=question, 
            insight_type=insight_type
        )
        
        # Generate visualizations data
        visualization_data = insights_engine.generate_visualization_data(file_path)
        
        return jsonify({
            'success': True,
            'insights': insights,
            'visualizations': visualization_data
        })
    except Exception as e:
        logger.error(f"Error generating insights: {str(e)}")
        return jsonify({'error': f'Error generating insights: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True) 