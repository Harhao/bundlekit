# cli-generator Specification

## Purpose
TBD - created by archiving change cli-scaffolding. Update Purpose after archive.
## Requirements
### Requirement: Template rendering
The Generator class SHALL render project files from a template directory using EJS templating, supporting variable injection (projectName, description, etc.).

#### Scenario: EJS template rendering
- **WHEN** a template file contains `<%= projectName %>`
- **THEN** the generator SHALL replace it with the actual project name

### Requirement: Recursive directory processing
The Generator SHALL recursively scan the template directory, processing `.ejs` files as templates and copying all other files as-is.

#### Scenario: Copy non-template files
- **WHEN** a template directory contains `src/styles.css` (no `.ejs` extension)
- **THEN** the file SHALL be copied to the output directory without modification

#### Scenario: Process nested directories
- **WHEN** the template has `src/components/Header.tsx.ejs`
- **THEN** the generator SHALL render it and output to `src/components/Header.tsx`

### Requirement: Conditional file generation
The Generator SHALL support conditional file inclusion based on template variables (e.g., skip certain files based on selected features).

#### Scenario: Skip files conditionally
- **WHEN** template config has `features: { typescript: false }`
- **THEN** files gated on `typescript` feature SHALL NOT be generated

